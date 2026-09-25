"use client";

import { useMemo, useState } from "react";

type Person = { id:string; name:string; phone:string; accessToken:string; received:number; total:number };
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);

export function BulkCollectionWhatsapp({poolTitle,participants}:{poolTitle:string;participants:Person[]}) {
  const [selected,setSelected]=useState<string[]>([]);
  const eligible=useMemo(()=>participants.filter(p=>p.phone&&p.accessToken),[participants]);
  const all=eligible.length>0&&selected.length===eligible.length;
  function toggleAll(){setSelected(all?[]:eligible.map(p=>p.id));}
  function openNext(){
    const p=eligible.find(x=>selected.includes(x.id)); if(!p)return;
    const phone=p.phone.replace(/\D/g,"");
    const due=Math.max(0,p.total-p.received);
    const payLink=`${window.location.origin}/p/${p.accessToken}`;
    const msg=`Olá, ${p.name}! No bolão ${poolTitle}, recebemos ${money(p.received)} e ainda faltam ${money(due)} para quitar sua participação.\n\nPagar minha cota: ${payLink}`;
    window.open(`https://wa.me/${phone.startsWith("55")?phone:`55${phone}`}?text=${encodeURIComponent(msg)}`,"_blank","noopener,noreferrer");
    setSelected(v=>v.filter(id=>id!==p.id));
  }
  return <div className="list">
    <div className="card">
      <label style={{display:"flex",gap:12,alignItems:"center",fontWeight:800}}>
        <input type="checkbox" checked={all} onChange={toggleAll}/> SELECIONAR TODOS
      </label>
      <span className="muted">{selected.length} selecionado(s). Cada mensagem leva o link individual do cartão de pagamento.</span>
      <button type="button" className="button primary" disabled={!selected.length} onClick={openNext}>
        {selected.length ? `ENVIAR COBRANÇA (${selected.length} RESTANTE${selected.length>1?"S":""})` : "SELECIONE QUEM VAI RECEBER"}
      </button>
    </div>
    {participants.map(p=>{const due=Math.max(0,p.total-p.received);return <div className="card" key={p.id}>
      <label style={{display:"flex",gap:12,alignItems:"center"}}>
        <input type="checkbox" disabled={!p.phone||!p.accessToken} checked={selected.includes(p.id)} onChange={()=>setSelected(v=>v.includes(p.id)?v.filter(id=>id!==p.id):[...v,p.id])}/>
        <strong>{p.name}</strong>
      </label>
      <span>Pago: {money(p.received)} · Falta: {money(due)}</span>
    </div>})}
  </div>;
}
