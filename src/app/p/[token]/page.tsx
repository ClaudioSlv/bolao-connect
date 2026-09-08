import Link from "next/link";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {ReminderOptIn} from "@/components/reminder-opt-in";
import {ParticipantSelfie} from "@/components/participant-selfie";
import {DEFAULT_POOL_RULES,DEFAULT_POOL_RULES_VERSION,SELFIE_CONSENT_TEXT,SELFIE_CONSENT_VERSION} from "@/lib/pool-rules";
export const dynamic="force-dynamic";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);

async function acceptRules(f:FormData){
  "use server";
  const token=String(f.get("token")??"");
  if(f.get("agreed")!=="on")throw new Error("É necessário aceitar as Regras do Bolão.");
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("id,pool_id,status").eq("access_token",token).maybeSingle();
  if(!p||p.status==="cancelled")throw new Error("Participante inválido.");
  const {data:pool}=await s.from("pools").select("rules_text,rules_version").eq("id",p.pool_id).maybeSingle();
  const text=pool?.rules_text||DEFAULT_POOL_RULES,version=Number(pool?.rules_version||DEFAULT_POOL_RULES_VERSION);
  const {error}=await s.from("pool_rule_acceptances").upsert({pool_id:p.pool_id,participant_id:p.id,rules_version:version,rules_text:text},{onConflict:"pool_id,participant_id,rules_version"});
  if(error)throw error;
  redirect(`/p/${token}?rules=accepted`);
}

async function saveSelfie(f:FormData){
  "use server";
  const token=String(f.get("token")??""),file=f.get("selfie");
  if(f.get("selfieConsent")!=="on")throw new Error("Autorize o armazenamento da selfie para continuar.");
  if(!(file instanceof File)||file.size<1)throw new Error("Tire ou selecione uma selfie.");
  if(file.size>5*1024*1024)throw new Error("A selfie deve ter no máximo 5 MB.");
  const allowed=["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type))throw new Error("Use uma foto JPG, PNG ou WebP.");
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("id,pool_id,status,selfie_path").eq("access_token",token).maybeSingle();
  if(!p||p.status==="cancelled")throw new Error("Participante inválido.");
  const ext=file.type.split("/")[1].replace("jpeg","jpg"),path=`${p.pool_id}/${p.id}/${crypto.randomUUID()}.${ext}`;
  const {error:uploadError}=await s.storage.from("participant-selfies").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError)throw uploadError;
  const {error}=await s.from("participants").update({selfie_path:path,selfie_consent_at:new Date().toISOString(),selfie_consent_version:SELFIE_CONSENT_VERSION}).eq("id",p.id);
  if(error){await s.storage.from("participant-selfies").remove([path]);throw error;}
  if(p.selfie_path)await s.storage.from("participant-selfies").remove([p.selfie_path]);
  redirect(`/p/${token}?selfie=saved`);
}

async function submitReceipt(f:FormData){
  "use server";
  const token=String(f.get("token")??""),file=f.get("receipt");
  if(!(file instanceof File)||file.size<1)throw new Error("Selecione o comprovante.");
  if(file.size>5*1024*1024)throw new Error("O arquivo deve ter no máximo 5 MB.");
  const allowed=["image/jpeg","image/png","image/webp","application/pdf"];
  if(!allowed.includes(file.type))throw new Error("Envie JPG, PNG, WebP ou PDF.");
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("id,pool_id,status,payment_status,selfie_path").eq("access_token",token).maybeSingle();
  if(!p||p.status==="cancelled"||p.payment_status==="confirmed")throw new Error("Este pagamento não aceita novo comprovante.");
  if(!p.selfie_path)throw new Error("Cadastre sua selfie antes de enviar o pagamento.");
  const {data:pool}=await s.from("pools").select("rules_version").eq("id",p.pool_id).maybeSingle(),version=Number(pool?.rules_version||DEFAULT_POOL_RULES_VERSION);
  const {data:acceptance}=await s.from("pool_rule_acceptances").select("id").eq("participant_id",p.id).eq("pool_id",p.pool_id).eq("rules_version",version).maybeSingle();
  if(!acceptance)throw new Error("Aceite as Regras do Bolão antes de enviar o pagamento.");
  const ext=file.type==="application/pdf"?"pdf":file.type.split("/")[1].replace("jpeg","jpg"),path=`${p.pool_id}/${p.id}/${crypto.randomUUID()}.${ext}`;
  const {error:u}=await s.storage.from("payment-receipts").upload(path,file,{contentType:file.type,upsert:false});if(u)throw u;
  await s.from("payment_submissions").update({status:"rejected",reviewed_at:new Date().toISOString()}).eq("participant_id",p.id).eq("status","pending");
  const {error}=await s.from("payment_submissions").insert({pool_id:p.pool_id,participant_id:p.id,receipt_path:path,status:"pending"});if(error)throw error;
  redirect(`/p/${token}?sent=1`);
}

export default async function Page({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{sent?:string}>}){
  const {token}=await params;const {sent}=await searchParams;let data:any=null;
  try{const s=createAdminClient();const {data:p}=await s.from("participants").select("id,pool_id,name,shares,status,payment_status,selfie_path,selfie_consent_at").eq("access_token",token).maybeSingle();if(p){const {data:pool}=await s.from("pools").select("title,lottery,share_price_cents,payment_deadline,rules_text,rules_version").eq("id",p.pool_id).maybeSingle();const {data:sub}=await s.from("payment_submissions").select("status,created_at").eq("participant_id",p.id).eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();const version=Number(pool?.rules_version||DEFAULT_POOL_RULES_VERSION);const {data:acceptance}=await s.from("pool_rule_acceptances").select("accepted_at").eq("participant_id",p.id).eq("pool_id",p.pool_id).eq("rules_version",version).maybeSingle();const {data:credits}=await s.from("participant_credits").select("remaining_cents").eq("participant_id",p.id).eq("status","available");data={p,pool,sub,acceptance,credit:(credits??[]).reduce((sum,row)=>sum+Number(row.remaining_cents||0),0)}}}catch{}
  if(!data?.p||!data?.pool)return <main className="shell"><section className="section"><h1>Link inválido</h1></section></main>;
  const {p,pool,sub,acceptance,credit}=data,amount=Number(p.shares)*Number(pool.share_price_cents),paid=p.payment_status==="confirmed",rules=pool.rules_text||DEFAULT_POOL_RULES,selfieDone=Boolean(p.selfie_path);
  return <main className="shell"><section className="section"><p className="eyebrow">BOLÃO CONNECT</p><h1>🍀 {pool.title}</h1><p><strong>{p.name}</strong> · {p.shares} cota(s) · <strong>{money(amount)}</strong></p><p className="muted">Prazo: {new Date(pool.payment_deadline).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p>{credit>0&&<p className="status">Crédito disponível: {money(credit)}</p>}</section>
  {!paid&&<ReminderOptIn token={token}/>}<section className="section"><h2>📜 Regras do Bolão</h2><div className="card"><span style={{whiteSpace:"pre-line"}}>{rules}</span></div>{acceptance?<p className="status">✓ Regras aceitas em {new Date(acceptance.accepted_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p>:<form className="form" action={acceptRules}><input type="hidden" name="token" value={token}/><label><input type="checkbox" name="agreed" required/> Li e estou de acordo com as Regras do Bolão.</label><button className="button primary">Aceitar regras e continuar</button></form>}</section>
  {acceptance&&<section className="section"><h2>📷 Selfie de identificação</h2>{selfieDone?<><p className="status">✓ Selfie cadastrada e protegida</p><p className="muted">A imagem fica em armazenamento privado e não é exibida aos demais participantes.</p></>:<form action={saveSelfie}><ParticipantSelfie token={token} consentText={SELFIE_CONSENT_TEXT}/><button className="button primary">Salvar selfie</button></form>}</section>}
  {acceptance&&selfieDone&&<section className="section"><h2>Pagamento por Pix</h2><div className="card"><strong>Telefone: 13 99132-0205</strong><span>CPF: 281.649.638-44</span></div>{paid?<p className="status">PAGAMENTO CONFIRMADO</p>:sub||sent?<><p className="status">COMPROVANTE RECEBIDO</p><p className="muted">Aguardando confirmação do organizador.</p></>:<form className="form" action={submitReceipt}><input type="hidden" name="token" value={token}/><div className="field"><label>Enviar comprovante</label><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/></div><button className="button primary">Enviar comprovante</button></form>}<p className="muted">O envio do comprovante não confirma o pagamento automaticamente. A confirmação final é feita pelo organizador.</p></section>}
  <Link className="back" href="/">Bolão Connect</Link></main>;
}
