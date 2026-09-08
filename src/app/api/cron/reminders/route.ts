import {NextResponse} from "next/server";
import webpush from "web-push";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
const TEN_DAYS=10*24*60*60*1000;

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT||"mailto:admin@bolao-connect.app";
  if(!pub||!priv)return NextResponse.json({error:"VAPID not configured"},{status:500});
  webpush.setVapidDetails(subject,pub,priv);
  const s=createAdminClient();
  const {data:subs,error}=await s.from("push_subscriptions").select("id,pool_id,participant_id,endpoint,p256dh,auth,last_sent_at,created_at").eq("enabled",true).limit(500);
  if(error)throw error;
  let sent=0,disabled=0,skipped=0;
  const now=Date.now();
  for(const sub of subs??[]){
    const {data:p}=await s.from("participants").select("name,status,payment_status,access_token").eq("id",sub.participant_id).maybeSingle();
    if(!p||p.status==="cancelled"||p.payment_status==="confirmed"){
      await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",sub.id);
      disabled++;
      continue;
    }
    const {data:pool}=await s.from("pools").select("title,payment_deadline,status").eq("id",sub.pool_id).maybeSingle();
    if(!pool||["drawn","archived"].includes(pool.status)||new Date(pool.payment_deadline).getTime()<=now){skipped++;continue}

    const anchor=sub.last_sent_at||sub.created_at;
    if(anchor&&now-new Date(anchor).getTime()<TEN_DAYS){skipped++;continue}

    const payload=JSON.stringify({title:"🍀 Bolão Connect",body:`${p.name}, não esqueça o pagamento do bolão ${pool.title}.`,url:`/p/${p.access_token}`,tag:`bolao-${sub.pool_id}`});
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);
      await s.from("push_subscriptions").update({last_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",sub.id);
      sent++;
    }catch(e:any){
      if(e?.statusCode===404||e?.statusCode===410){
        await s.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",sub.id);
        disabled++;
      }
    }
  }
  return NextResponse.json({ok:true,sent,disabled,skipped});
}
