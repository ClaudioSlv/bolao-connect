import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {OrganizerCta} from "@/components/organizer-cta";
import {SharePoolLink} from "@/components/share-pool-link";
import {getOrganizerBrand} from "@/lib/organizer-brand";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
export const dynamic="force-dynamic";

export default async function PublicPool({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const s=createAdminClient();
  const {data:pool}=await s.from("pools").select("id,owner_id,title,lottery,contest_number,estimated_prize_cents,share_price_cents,total_shares,payment_deadline,draw_at,status").eq("public_slug",slug).maybeSingle();
  if(!pool)return <main className="shell"><section className="section"><h1>Bolão não encontrado</h1><p className="muted">Confira se o link recebido está correto.</p></section></main>;

  const organizerBrand=await getOrganizerBrand(s,pool.owner_id);
  const [{data:participants},{data:games},{data:wallet},{data:plan}]=await Promise.all([
    s.from("participants").select("shares,status").eq("pool_id",pool.id),
    s.from("games").select("id,numbers").eq("pool_id",pool.id),
    s.from("wallet_transactions").select("amount_cents").eq("pool_id",pool.id),
    s.from("pools").select("planned_games,numbers_per_game").eq("id",pool.id).maybeSingle(),
  ]);

  const confirmed=(participants??[]).filter(p=>p.status==="confirmed");
  const participantCount=confirmed.length;
  const usedShares=confirmed.reduce((sum,p)=>sum+(Number(p.shares)||0),0);
  const available=Math.max(0,Number(pool.total_shares)-usedShares);
  const waitlistCount=(participants??[]).filter(p=>p.status==="waitlisted").length;
  const collected=(wallet??[]).reduce((sum,row)=>sum+Number(row.amount_cents||0),0);
  const target=Number(pool.total_shares)*Number(pool.share_price_cents);
  const progress=target?Math.max(0,Math.min(100,Math.round(collected/target*100))):0;
  const plannedGames=Number(plan?.planned_games||0);
  const inferredNumbers=Array.isArray(games?.[0]?.numbers)?games?.[0]?.numbers.length:0;
  const numbersPerGame=Number(plan?.numbers_per_game||inferredNumbers||0);
  const deadlinePassed=new Date(pool.payment_deadline).getTime()<Date.now();
  const registrationOpen=pool.status==="open"&&!deadlinePassed;
  const isFull=available<1;

  return <main className="shell">
    <section className="section">
      <p className="eyebrow">{organizerBrand.name.toUpperCase()}</p>
      <h1>🍀 {pool.title}</h1>
      <p className="muted">{pool.lottery}{pool.contest_number?` · Concurso ${pool.contest_number}`:""}</p>
      <SharePoolLink/>
    </section>

    <section className="section">
      <h2>Informações do bolão</h2>
      <div className="wallet">
        <div className="wallet-row"><span>Valor da participação</span><strong>{money(Number(pool.share_price_cents))}</strong></div>
        {pool.estimated_prize_cents?<div className="wallet-row"><span>Prêmio estimado</span><strong>{money(Number(pool.estimated_prize_cents))}</strong></div>:null}
        <div className="wallet-row"><span>Participantes</span><strong>{participantCount} / {pool.total_shares}</strong></div>
        <div className="wallet-row"><span>Vagas/cotas disponíveis</span><strong>{available}</strong></div>
        {waitlistCount>0?<div className="wallet-row"><span>Lista de espera</span><strong>{waitlistCount}</strong></div>:null}
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
      {registrationOpen?<>
        <h2>{isFull?"⏳ Lista de espera aberta":"Quer participar?"}</h2>
        <p className="muted">{isFull?"As vagas principais estão preenchidas. Você pode entrar na lista de espera por ordem de inscrição e só deverá pagar se ganhar uma vaga.":"Ao participar, você ocupa 1 vaga/cota deste bolão e cria seu cadastro de participante."}</p>
        <Link className="button primary" href={`/bolao/${slug}/entrar`}>{isFull?"⏳ ENTRAR NA LISTA DE ESPERA":"🍀 PARTICIPAR DO BOLÃO"}</Link>
      </>:<>
        <h2>Participação indisponível</h2>
        <p className="muted">{deadlinePassed?"O prazo de participação deste bolão terminou.":"Este bolão não está aberto para novas participações."}</p>
      </>}
    </section>
    <OrganizerCta/>
  </main>;
}
