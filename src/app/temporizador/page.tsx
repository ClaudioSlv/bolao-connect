import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {PoolCountdown} from "@/components/pool-countdown";
import {TimerReminderOptIn} from "@/components/timer-reminder-opt-in";
import {OrganizerCta} from "@/components/organizer-cta";
import {NEXT_POOL_PRELAUNCH} from "@/lib/next-pool";
import {DEFAULT_APP_BRAND} from "@/lib/organizer-brand";

export const dynamic="force-dynamic";

export default async function TimerRedirect(){
  try{
    const s=createAdminClient();
    const {data:pool,error}=await s.from("pools").select("public_slug").eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);
  }catch{
    return <main className="shell"><section className="section"><h1>Temporizador indisponível</h1><p className="muted">Não foi possível carregar os bolões neste momento.</p></section></main>;
  }

  const beforeOpening=Date.now()<new Date(NEXT_POOL_PRELAUNCH.opensAt).getTime();

  return <main className="shell">
    <section className="section" style={{textAlign:"center"}}>
      <p className="eyebrow">{DEFAULT_APP_BRAND.toUpperCase()}</p>
      <h1>🍀 {NEXT_POOL_PRELAUNCH.title}</h1>
      <p className="muted">Próximo bolão</p>
    </section>

    <section className="section">
      {beforeOpening?<>
        <p className="eyebrow" style={{textAlign:"center"}}>CONTAGEM REGRESSIVA PARA A ABERTURA DO PRÓXIMO BOLÃO</p>
        <PoolCountdown target={NEXT_POOL_PRELAUNCH.opensAt}/>
        <p className="muted" style={{textAlign:"center",marginTop:12}}>Abertura prevista: {NEXT_POOL_PRELAUNCH.displayOpensAt}</p>
      </>:<>
        <p className="eyebrow" style={{textAlign:"center"}}>AGUARDANDO LIBERAÇÃO DO ORGANIZADOR</p>
        <h2 style={{textAlign:"center"}}>O próximo bolão ainda não foi publicado.</h2>
      </>}
    </section>

    {beforeOpening&&<TimerReminderOptIn campaignKey={NEXT_POOL_PRELAUNCH.key}/>} 

    <section className="section" style={{textAlign:"center"}}>
      <h2>Participação ainda fechada</h2>
      <p className="muted">Você já pode acompanhar o temporizador e ativar os lembretes. A participação será liberada quando o organizador criar e publicar o bolão.</p>
      <button className="button primary" type="button" disabled style={{opacity:.45,cursor:"not-allowed",width:"100%"}}>🔒 PARTICIPAR DO BOLÃO — FECHADO</button>
    </section>

    <OrganizerCta/>
  </main>;
}
