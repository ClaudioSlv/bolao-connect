import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {PoolCountdown} from "@/components/pool-countdown";

export const dynamic="force-dynamic";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);

export default async function TimerPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;

  try{
    const s=createAdminClient();
    const {data:pool,error:poolError}=await s.from("pools").select("id,title,lottery,contest_number,estimated_prize_cents,share_price_cents,total_shares,payment_deadline,draw_at,status,public_slug").eq("public_slug",slug).maybeSingle();
    if(poolError)throw poolError;
    if(!pool)return <main className="shell"><section className="section"><h1>Bolão não encontrado</h1><p className="muted">Confira se o link recebido está correto.</p></section></main>;

    const [{data:participants,error:participantsError},{data:games,error:gamesError}]=await Promise.all([
      s.from("participants").select("shares,status").eq("pool_id",pool.id),
      s.from("games").select("id,numbers").eq("pool_id",pool.id),
    ]);
    if(participantsError)throw participantsError;
    if(gamesError)throw gamesError;

    const active=(participants??[]).filter(p=>p.status!=="cancelled");
    const used=active.reduce((sum,p)=>sum+(Number(p.shares)||0),0);
    const available=Math.max(0,Number(pool.total_shares)-used);
    const numbersPerGame=Array.isArray(games?.[0]?.numbers)?games?.[0]?.numbers.length:0;
    const closed=pool.status!=="open"||new Date(pool.payment_deadline).getTime()<=Date.now()||available<1;

    return <main className="shell">
      <section className="section" style={{textAlign:"center"}}>
        <p className="eyebrow">BOLÃO CONNECT</p>
        <h1>🍀 {pool.title}</h1>
        <p className="muted">{pool.lottery}{pool.contest_number?` · Concurso ${pool.contest_number}`:""}</p>
      </section>

      <section className="section">
        <p className="eyebrow" style={{textAlign:"center"}}>CONTAGEM REGRESSIVA PARA O PRAZO DE PAGAMENTO</p>
        <PoolCountdown target={pool.payment_deadline}/>
        <p className="muted" style={{textAlign:"center",marginTop:12}}>Prazo: {new Date(pool.payment_deadline).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p>
      </section>

      <section className="section">
        <div className="wallet">
          {pool.estimated_prize_cents?<div className="wallet-row"><span>🏆 Prêmio estimado</span><strong>{money(Number(pool.estimated_prize_cents))}</strong></div>:null}
          <div className="wallet-row"><span>👥 Participantes</span><strong>{active.length} / {pool.total_shares}</strong></div>
          <div className="wallet-row"><span>🎟️ Vagas disponíveis</span><strong>{available}</strong></div>
          <div className="wallet-row"><span>🎯 Jogos cadastrados</span><strong>{games?.length??0}</strong></div>
          {numbersPerGame?<div className="wallet-row"><span>🔢 Dezenas por jogo</span><strong>{numbersPerGame}</strong></div>:null}
          <div className="wallet-row"><span>💵 Valor da participação</span><strong>{money(Number(pool.share_price_cents))}</strong></div>
          {pool.draw_at?<div className="wallet-row"><span>📅 Sorteio</span><strong>{new Date(pool.draw_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</strong></div>:null}
        </div>
      </section>

      <section className="section" style={{textAlign:"center"}}>
        {closed?<><h2>Participação indisponível</h2><p className="muted">{available<1?"Todas as vagas já foram preenchidas.":"O prazo deste bolão terminou ou ele não está aberto para novas participações."}</p></>:<><h2>Quer participar?</h2><p className="muted">Confira os dados do bolão e confirme sua participação pelo app.</p><Link className="button primary" href={`/bolao/${slug}`}>🍀 PARTICIPAR DO BOLÃO</Link></>}
      </section>
    </main>;
  }catch{
    return <main className="shell"><section className="section"><h1>Temporizador indisponível</h1><p className="muted">Não foi possível carregar os dados deste bolão. A configuração segura do Supabase na Vercel precisa ser conferida.</p></section></main>;
  }
}
