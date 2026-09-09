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
  const {data:p}=await s.from("participants").select("id,pool_id,name,status,access_token").eq("id",participantId).maybeSingle();
  if(!p||p.status!=="confirmed")return {sent:0,skipped:true};
  const {data:pool}=await s.from("pools").select("owner_id,title").eq("id",p.pool_id).maybeSingle();
  if(!pool)return {sent:0,skipped:true};
  const {data:subs}=await s.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("participant_id",p.id).eq("enabled",true);
  if(!subs?.length)return {sent:0,skipped:true};
  const brand=await getOrganizerBrand(s,pool.owner_id);
  const payload=JSON.stringify({title:"🍀 Você ganhou uma vaga!",body:`${p.name}, uma vaga foi liberada e agora você está participando do ${pool.title}.`,url:`/p/${p.access_token}`,tag:`vaga-${p.pool_id}-${p.id}`});
  let sent=0;
  for(const sub of subs){
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);
      sent++;
    }catch(e:any){
      if(e?.statusCode===404||e?.statusCode===410)await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",sub.id);
    }
  }
  await s.from("audit_events").insert({pool_id:p.pool_id,event_type:"waitlist_promotion_push",entity_type:"participant",entity_id:p.id,details:{sent,brand:brand.name}});
  return {sent,skipped:false};
}
