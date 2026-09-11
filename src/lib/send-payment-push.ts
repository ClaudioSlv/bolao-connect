import webpush from "web-push";
import {createAdminClient} from "@/lib/supabase/admin";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
export type PushResult={status:"sent"|"no_subscription"|"expired"|"failed"|"configuration_error";sent:number;failed:number;expired:number;errors:Array<{statusCode:number|null;message:string}>};

async function sendParticipantPush(input:{participantId:string;title:string;body:(participantName:string,poolTitle:string)=>string;tagPrefix:string;eventType:string}){
  const s=createAdminClient();
  const{data:p}=await s.from("participants").select("id,name,pool_id,access_token,status").eq("id",input.participantId).maybeSingle();
  if(!p||p.status==="cancelled")return {status:"no_subscription",sent:0,failed:0,expired:0,errors:[]} satisfies PushResult;
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
  if(!pub||!priv){const result={status:"configuration_error",sent:0,failed:0,expired:0,errors:[{statusCode:null,message:"Chaves VAPID ausentes na produção."}]} satisfies PushResult;await s.from("audit_events").insert({pool_id:p.pool_id,event_type:input.eventType,entity_type:"participant",entity_id:p.id,details:result});return result}
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@bolao-connect.app",pub,priv);
  const[{data:pool},{data:subs}]=await Promise.all([s.from("pools").select("title").eq("id",p.pool_id).maybeSingle(),s.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("participant_id",p.id).eq("enabled",true)]);
  const active=subs??[];
  if(!active.length){const result={status:"no_subscription",sent:0,failed:0,expired:0,errors:[]} satisfies PushResult;await s.from("audit_events").insert({pool_id:p.pool_id,event_type:input.eventType,entity_type:"participant",entity_id:p.id,details:result});return result}
  const payload=JSON.stringify({title:input.title,body:input.body(p.name,pool?.title||"bolão"),url:`/p/${p.access_token}`,tag:`${input.tagPrefix}-${p.pool_id}-${p.id}`});
  let sent=0,failed=0,expired=0;const errors:PushResult["errors"]=[];
  for(const sub of active){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);sent++;await s.from("push_subscriptions").update({last_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",sub.id)}catch(error:any){const statusCode=typeof error?.statusCode==="number"?error.statusCode:null,message=String(error?.body||error?.message||"Falha desconhecida no serviço push").slice(0,500);errors.push({statusCode,message});if(statusCode===404||statusCode===410){expired++;await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",sub.id)}else failed++}}
  const status:PushResult["status"]=sent>0?"sent":expired===active.length?"expired":"failed",result={status,sent,failed,expired,errors};
  await s.from("audit_events").insert({pool_id:p.pool_id,event_type:input.eventType,entity_type:"participant",entity_id:p.id,details:result});return result;
}

export function sendPaymentConfirmedPush(input:{participantId:string;amountCents:number}){return sendParticipantPush({participantId:input.participantId,title:"✅ Pagamento confirmado!",body:(name,pool)=>`${name}, recebemos ${money(input.amountCents)}. Sua participação no ${pool} está garantida.`,tagPrefix:"pagamento",eventType:"payment_confirmation_push"})}
export function sendTestNotification(participantId:string){return sendParticipantPush({participantId,title:"🍀 Participação reservada!",body:()=>"Parabéns, você já reservou a sua participação no Bolão Amigos BTP.",tagPrefix:"teste-notificacao",eventType:"notification_test"})}
