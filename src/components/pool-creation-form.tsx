"use client";

import {useMemo,useState} from "react";
import type {LotteryId} from "@/lib/domain";
import {calculatePoolPricing,LOTTERY_LABELS,LOTTERY_NUMBER_LIMITS,type GamePlanInput} from "@/lib/lottery-pricing";

type Row=GamePlanInput&{id:string};
type FormAction=(formData:FormData)=>void|Promise<void>;

const LOTTERIES=Object.keys(LOTTERY_LABELS) as LotteryId[];
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
const makeRow=(lottery:LotteryId):Row=>({id:crypto.randomUUID(),quantity:1,numbers:LOTTERY_NUMBER_LIMITS[lottery].defaultValue,trevos:lottery==="mais-milionaria"?2:undefined});

export function PoolCreationForm({action}:{action:FormAction}){
  const[lottery,setLottery]=useState<LotteryId>("mega-sena");
  const[participants,setParticipants]=useState(30);
  const[rows,setRows]=useState<Row[]>(()=>[makeRow("mega-sena")]);

  const calculation=useMemo(()=>{
    try{return calculatePoolPricing(lottery,rows,participants)}catch{return null}
  },[lottery,rows,participants]);

  const limits=LOTTERY_NUMBER_LIMITS[lottery];
  const numberOptions=Array.from({length:limits.max-limits.min+1},(_,i)=>limits.min+i);

  const changeLottery=(next:LotteryId)=>{
    setLottery(next);
    setRows([makeRow(next)]);
  };

  const updateRow=(id:string,patch:Partial<Row>)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));
  const addRow=()=>setRows(current=>[...current,makeRow(lottery)]);
  const removeRow=(id:string)=>setRows(current=>current.length>1?current.filter(row=>row.id!==id):current);

  return <form className="form" action={action}>
    <div className="field"><label>Nome do bolão</label><input name="title" required maxLength={120} placeholder="Ex.: Mega da Virada 2026"/></div>

    <div className="field"><label>Modalidade</label><select name="lottery" value={lottery} onChange={e=>changeLottery(e.target.value as LotteryId)}>{LOTTERIES.map(id=><option key={id} value={id}>{LOTTERY_LABELS[id]}</option>)}</select></div>

    <div className="field"><label>Número do concurso</label><input name="contestNumber" type="number" min="1" inputMode="numeric" placeholder="Opcional"/></div>

    <div className="field"><label>Número de participantes</label><input name="totalShares" type="number" min="1" required value={participants} onChange={e=>setParticipants(Math.max(1,Number(e.target.value)||1))}/></div>

    <section className="card" style={{display:"grid",gap:12}}>
      <div><strong>🎟️ Planejamento dos jogos</strong><span>Informe quantos jogos serão feitos e quantas dezenas terá cada tipo de jogo.</span></div>

      {rows.map((row,index)=><div key={row.id} style={{display:"grid",gap:10,paddingTop:index?12:0,borderTop:index?"1px solid #294231":"none"}}>
        <div className="field"><label>Quantidade de jogos</label><input type="number" min="1" inputMode="numeric" value={row.quantity} onChange={e=>updateRow(row.id,{quantity:Math.max(1,Number(e.target.value)||1)})}/></div>
        <div className="field"><label>{lottery==="super-sete"?"Prognósticos por jogo":"Dezenas por jogo"}</label><select value={row.numbers} onChange={e=>updateRow(row.id,{numbers:Number(e.target.value)})}>{numberOptions.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
        {lottery==="mais-milionaria"&&<div className="field"><label>Trevos por jogo</label><select value={row.trevos??2} onChange={e=>updateRow(row.id,{trevos:Number(e.target.value)})}>{[2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <span className="muted">Valor deste tipo: {calculation?money(calculation.items[index]?.subtotalCents??0):"—"}</span>
          {rows.length>1&&<button type="button" className="button secondary" style={{padding:"8px 10px"}} onClick={()=>removeRow(row.id)}>Remover</button>}
        </div>
      </div>)}

      <button type="button" className="button secondary" onClick={addRow}>+ Adicionar outro tipo de jogo</button>
    </section>

    <section className="wallet">
      <div className="wallet-row"><span>Custo total dos jogos</span><strong>{calculation?money(calculation.totalCostCents):"—"}</strong></div>
      <div className="wallet-row"><span>Total de jogos</span><strong>{calculation?.totalGames??0}</strong></div>
      <div className="wallet-row"><span>Participantes</span><strong>{participants}</strong></div>
      <div className="wallet-row"><span>💵 Valor por participante</span><strong style={{fontSize:22}}>{calculation?money(calculation.sharePriceCents):"—"}</strong></div>
      <small>O Bolão Connect calcula automaticamente usando o valor das apostas. Se a divisão gerar fração de centavo, a cota é arredondada para cima para não faltar dinheiro.</small>
      {calculation&&calculation.roundingDifferenceCents>0&&<small style={{display:"block",marginTop:8}}>Diferença total de arredondamento: {money(calculation.roundingDifferenceCents)}.</small>}
    </section>

    <input type="hidden" name="gamePlan" value={JSON.stringify(rows.map(({quantity,numbers,trevos})=>({quantity,numbers,trevos})))}/>

    <div className="field"><label>Prêmio estimado (R$)</label><input name="estimatedPrize" inputMode="decimal" placeholder="Opcional"/></div>
    <div className="field"><label>Prazo de pagamento</label><input name="paymentDeadline" type="datetime-local" required/></div>
    <div className="field"><label>Data e hora do sorteio</label><input name="drawAt" type="datetime-local"/></div>

    <button className="button primary" disabled={!calculation}>Criar bolão com cota automática</button>
  </form>;
}
