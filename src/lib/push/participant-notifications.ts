import webpush from "web-push";
import {createAdminClient} from "@/lib/supabase/admin";
import {getOrganizerBrand} from "@/lib/organizer-brand";

function configureWebPush(){
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT||"mailto:admin@bolao-connect.app";
  if(!pub||!priv)return false;
  webpush.setVapidDetails(subject,pub,priv);
  return true;
}

export async function sendWaitlistPromotionPush(participantId:string){
  if(!configureWebPush())return {sent:0,skipped:true};
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("id,pool_id,name,status,access_token,payment_deadline_override").eq("id",participantId).maybeSingle();
  if(!p||p.status!=="confirmed")return {sent:0,skipped:true};
  const {data:pool}=await s.from("pools").select("owner_id,title").eq("id",p.pool_id).maybeSingle();
  if(!pool)return {sent:0,skipped:true};
  const {data:subs}=await s.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("participant_id",p.id).eq("enabled",true);
  if(!subs?.length)return {sent:0,skipped:true};
  const brand=await getOrganizerBrand(s,pool.owner_id);
  const deadline=p.payment_deadline_override?new Date(p.payment_deadline_override).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}):null;
  const payload=JSON.stringify({title:"🍀 Você ganhou uma vaga!",body:deadline?`${p.name}, uma vaga foi liberada no ${pool.title}. Pague até ${deadline} para garantir sua participação.`:`${p.name}, uma vaga foi liberada e agora você está participando do ${pool.title}.`,url:`/p/${p.access_token}`,tag:`vaga-${p.pool_id}-${p.id}`});
  let sent=0;
  for(const sub of subs){
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);
      sent++;
    }catch(e:any){
      if(e?.statusCode===404||e?.statusCode===410)await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("endpoint",sub.endpoint);
    }
  }
  await s.from("audit_events").insert({pool_id:p.pool_id,event_type:"waitlist_promotion_push",entity_type:"participant",entity_id:p.id,details:{sent,brand:brand.name}});
  await s.from("waitlist_promotion_outbox").update({dispatched_at:new Date().toISOString()})
    .eq("pool_id",p.pool_id).eq("participant_id",p.id).is("dispatched_at",null);
  return {sent,skipped:false};
}

export async function sendPaymentDeadlinePush(participantId:string, deadline:string){
  if(!configureWebPush())throw new Error("As chaves VAPID não estão configuradas.");
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("id,pool_id,name,status,payment_status,access_token,is_test,payment_deadline_override").eq("id",participantId).maybeSingle();
  if(!p || p.is_test || p.payment_status==="confirmed" || !["confirmed","expired"].includes(p.status))return {sent:0,skipped:true};
  const {data:pool}=await s.from("pools").select("title,payment_deadline,status").eq("id",p.pool_id).maybeSingle();
  if(!pool || ["drawn","archived"].includes(pool.status) || new Date(p.payment_deadline_override||pool.payment_deadline).getTime()!==new Date(deadline).getTime())return {sent:0,skipped:true};
  const {data:subs,error}=await s.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("participant_id",p.id).eq("enabled",true);
  if(error)throw error;
  let sent=0,failed=0;
  const payload=JSON.stringify({title:"⏰ Prazo de pagamento encerrado",body:`${p.name}, o prazo de pagamento do ${pool.title} terminou. Não é possível gerar outro QR Code. A vaga com saldo pendente poderá ser liberada após 24 horas de conciliação.`,url:`/p/${p.access_token}`,tag:`prazo-encerrado-${p.pool_id}-${p.id}-${deadline}`});
  for(const sub of subs??[]){
    try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);sent++}
    catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("endpoint",sub.endpoint);else failed++}
  }
  if(failed)throw new Error(`Falha no envio para ${failed} dispositivo(s).`);
  await s.from("audit_events").insert({pool_id:p.pool_id,event_type:"payment_deadline_push",entity_type:"participant",entity_id:p.id,details:{sent,deadline}});
  return {sent,skipped:false};
}
