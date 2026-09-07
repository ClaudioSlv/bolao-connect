import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function POST(req:Request){
  try{
    const body=await req.json();
    const token=String(body.token??"");
    const subscription=body.subscription;
    if(!token||!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth)return NextResponse.json({error:"Dados inválidos."},{status:400});
    const s=createAdminClient();
    const {data:p}=await s.from("participants").select("id,pool_id,status,payment_status").eq("access_token",token).maybeSingle();
    if(!p||p.status==="cancelled"||p.payment_status==="confirmed")return NextResponse.json({error:"Participante indisponível."},{status:404});
    const {error}=await s.from("push_subscriptions").upsert({pool_id:p.pool_id,participant_id:p.id,endpoint:subscription.endpoint,p256dh:subscription.keys.p256dh,auth:subscription.keys.auth,enabled:true,updated_at:new Date().toISOString()},{onConflict:"endpoint"});
    if(error)throw error;
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:"Não foi possível ativar os lembretes."},{status:500})}
}
