import webpush from "web-push";
import {createAdminClient} from "@/lib/supabase/admin";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);

export async function sendPaymentConfirmedPush(input:{participantId:string;amountCents:number}){
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
  if(!pub||!priv)return {sent:0};
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@bolao-connect.app",pub,priv);
  const s=createAdminClient();
  const{data:p}=await s.from("participants").select("id,name,pool_id,access_token,status").eq("id",input.participantId).maybeSingle();
  if(!p||p.status==="cancelled")return {sent:0};
  const{data:pool}=await s.from("pools").select("title").eq("id",p.pool_id).maybeSingle();
  const{data:subs}=await s.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("participant_id",p.id).eq("enabled",true);
  const payload=JSON.stringify({title:"✅ Pagamento confirmado!",body:`${p.name}, recebemos ${money(input.amountCents)}. Sua participação no ${pool?.title||"bolão"} está garantida.`,url:`/p/${p.access_token}`,tag:`pagamento-${p.pool_id}-${p.id}`});
  let sent=0;
  for(const sub of subs??[]){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);sent++}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",sub.id)}}
  return {sent};
}
