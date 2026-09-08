import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
export const dynamic="force-dynamic";

export default async function PublicPool({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const s=createAdminClient();
  const {data:pool}=await s.from("pools").select("id,title,lottery,contest_number,estimated_prize_cents,share_price_cents,total_shares,payment_deadline,draw_at,status").eq("public_slug",slug).maybeSingle();
  if(!pool)return <main className="shell"><section className="section"><h1>Bolão não encontrado</h1><p className="muted">Confira se o link recebido está correto.</p></section></main>;

  const [{data:participants},{data:games},{data:wallet},{data:plan}]=await Promise.all([
    s.from("participants").select("shares,status").eq("pool_id",pool.id),
    s.from("games").select("id,numbers").eq("pool_id",pool.id),
    s.from("wallet_transactions").select("amount_cents").eq("pool_id",pool.id),
    s.from("pools").select("planned_games,numbers_per_game").eq("id",pool.id).maybeSingle(),
  ]);

  const active=(participants??[]).filter(p=>p.status!=="cancelled");
  const participantCount=active.length;
  const usedShares=active.reduce((sum,p)=>sum+(Number(p.shares)||0),0);
  const available=Math.max(0,Number(pool.total_shares)-usedShares);
  const collected=(wallet??[]).reduce((sum,row)=>sum+Number(row.amount_cents||0),0);
  const target=Number(pool.total_shares)*Number(pool.share_price_cents);
  const progress=target?Math.max(0,Math.min(100,Math.round(collected/target*100))):0;
  const plannedGames=Number(plan?.planned_games||0);
  const inferredNumbers=Array.isArray(games?.[0]?.numbers)?games?.[0]?.numbers.length:0;
  const numbersPerGame=Number(plan?.numbers_per_game||inferredNumbers||0);
  const deadlinePassed=new Date(pool.payment_deadline).getTime()<Date.now();
  const canJoin=pool.status==="open"&&!deadlinePassed&&available>0;

  return <main className="shell">
    <section className="section">
      <p className="eyebrow">BOLÃO CONNECT</p>
      <h1>🍀 {pool.title}</h1>
      <p className="muted">{pool.lottery}{pool.contest_number?` · Concurso ${pool.contest_number}`:""}</p>
    </section>

    <section className="section">
      <h2>Informações do bolão</h2>
      <div className="wallet">
        <div className="wallet-row"><span>Valor da participação</span><strong>{money(Number(pool.share_price_cents))}</strong></div>
        {pool.estimated_prize_cents?<div className="wallet-row"><span>Prêmio estimado</span><strong>{money(Number(pool.estimated_prize_cents))}</strong></div>:null}
        <div className="wallet-row"><span>Participantes</span><strong>{participantCount} / {pool.total_shares}</strong></div>
        <div className="wallet-row"><span>Vagas/cotas disponíveis</span><strong>{available}</strong></div>
        <div className="wallet-row"><span>Jogos</span><strong>{games?.length??0}{plannedGames?` de ${plannedGames}`:" cadastrados"}</strong></div>
        {numbersPerGame?<div className="wallet-row"><span>Dezenas por jogo</span><strong>{numbersPerGame}</strong></div>:null}
        <div className="wallet-row"><span>Prazo para pagamento</span><strong>{new Date(pool.payment_deadline).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</strong></div>
        {pool.draw_at?<div className="wallet-row"><span>Sorteio</span><strong>{new Date(pool.draw_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</strong></div>:null}
      </div>
    </section>

    <section className="section">
      <h2>💰 Carteira do bolão</h2>
      <div className="wallet">
        <div className="wallet-row"><span>Arrecadado</span><strong>{money(collected)}</strong></div>
        <div className="progress"><div style={{width:`${progress}%`}}/></div>
        <div className="wallet-row"><span>Meta</span><span>{money(target)}</span></div>
        <small>{progress}% arrecadado</small>
      </div>
    </section>

    <section className="section">
      {canJoin?<>
        <h2>Quer participar?</h2>
        <p className="muted">Ao entrar, você ocupa 1 vaga/cota deste bolão e cria seu cadastro de participante.</p>
        <Link className="button primary" href={`/bolao/${slug}/entrar`}>🍀 ENTRAR NO BOLÃO</Link>
      </>:<>
        <h2>Entradas indisponíveis</h2>
        <p className="muted">{available<1?"Todas as vagas deste bolão já foram preenchidas.":deadlinePassed?"O prazo de entrada/pagamento deste bolão terminou.":"Este bolão não está aberto para novas entradas."}</p>
      </>}
    </section>
  </main>;
}
