import Link from "next/link";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

function normalizePhone(value:string){return value.replace(/\D/g,"");}

async function joinPool(form:FormData){
  "use server";
  const slug=String(form.get("slug")??"").trim();
  const name=String(form.get("name")??"").trim().replace(/\s+/g," ");
  const phone=normalizePhone(String(form.get("phone")??""));
  if(!slug||name.length<2||name.length>120)throw new Error("Informe seu nome corretamente.");
  if(phone.length<10||phone.length>13)throw new Error("Informe um WhatsApp válido com DDD.");
  if(form.get("confirm")!=="on")throw new Error("Confirme sua participação para continuar.");

  const s=createAdminClient();
  const {data:pool}=await s.from("pools").select("id,title,total_shares,payment_deadline,status").eq("public_slug",slug).maybeSingle();
  if(!pool)throw new Error("Bolão não encontrado.");
  if(pool.status!=="open")throw new Error("Este bolão não está aberto para novas participações.");
  if(new Date(pool.payment_deadline).getTime()<Date.now())throw new Error("O prazo para participar deste bolão terminou.");

  const {data:participants,error:listError}=await s.from("participants").select("id,phone,shares,status").eq("pool_id",pool.id);
  if(listError)throw new Error("Não foi possível verificar as vagas do bolão.");
  const active=(participants??[]).filter(p=>p.status!=="cancelled");
  const usedShares=active.reduce((sum,p)=>sum+(Number(p.shares)||0),0);
  if(usedShares>=Number(pool.total_shares))throw new Error("As vagas deste bolão já foram preenchidas.");

  const duplicated=active.some(p=>normalizePhone(String(p.phone??""))===phone);
  if(duplicated)throw new Error("Este WhatsApp já possui participação neste bolão. Peça ao organizador o seu link individual.");

  const {data:participant,error}=await s.from("participants").insert({
    pool_id:pool.id,
    name,
    phone,
    shares:1,
    status:"confirmed",
    payment_status:"pending",
  }).select("id,access_token").single();
  if(error||!participant?.access_token)throw new Error(error?.message||"Não foi possível confirmar sua participação.");

  await s.from("audit_events").insert({
    pool_id:pool.id,
    event_type:"participant_self_joined",
    entity_type:"participant",
    entity_id:participant.id,
    details:{source:"public_pool_link"},
  });

  redirect(`/p/${participant.access_token}?joined=1`);
}

export default async function JoinPool({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const s=createAdminClient();
  const {data:pool}=await s.from("pools").select("id,title,lottery,total_shares,share_price_cents,payment_deadline,status").eq("public_slug",slug).maybeSingle();
  if(!pool)return <main className="shell"><section className="section"><h1>Bolão não encontrado</h1></section></main>;
  const {data:participants}=await s.from("participants").select("shares,status").eq("pool_id",pool.id);
  const used=(participants??[]).filter(p=>p.status!=="cancelled").reduce((sum,p)=>sum+(Number(p.shares)||0),0);
  const available=Math.max(0,Number(pool.total_shares)-used);
  const closed=pool.status!=="open"||new Date(pool.payment_deadline).getTime()<Date.now()||available<1;

  return <main className="shell">
    <Link className="back" href={`/bolao/${slug}`}>← Voltar ao bolão</Link>
    <section className="section">
      <p className="eyebrow">PARTICIPAR DO BOLÃO</p>
      <h1>🍀 {pool.title}</h1>
      <p className="muted">{pool.lottery} · {available} vaga(s) disponível(is)</p>
    </section>
    <section className="section">
      {closed?<><h2>Participação indisponível</h2><p className="muted">Este bolão não possui novas vagas disponíveis neste momento.</p></>:<>
        <h2>Crie seu cadastro de participante</h2>
        <p className="muted">Você não escolhe quantidade de cotas. Ao confirmar, será reservada 1 vaga/cota deste bolão para você.</p>
        <form className="form" action={joinPool}>
          <input type="hidden" name="slug" value={slug}/>
          <div className="field"><label>Seu nome</label><input name="name" required maxLength={120} autoComplete="name" placeholder="Nome completo"/></div>
          <div className="field"><label>WhatsApp com DDD</label><input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(13) 99999-9999"/></div>
          <label><input type="checkbox" name="confirm" required/> Confirmo que quero participar deste bolão e reservar 1 vaga/cota.</label>
          <button className="button primary">CONFIRMAR PARTICIPAÇÃO</button>
        </form>
      </>}
    </section>
  </main>;
}
