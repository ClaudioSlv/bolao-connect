import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function POST(req:Request){
  try{
    const body=await req.json();
    const slug=String(body.slug??"").trim();
    const subscription=body.subscription;
    if(!slug||!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth){
      return NextResponse.json({error:"Dados inválidos."},{status:400});
    }

    const s=createAdminClient();
    const {data:pool,error:poolError}=await s.from("pools").select("id,status,payment_deadline,public_slug").eq("public_slug",slug).maybeSingle();
    if(poolError)throw poolError;
    if(!pool||pool.status!=="open")return NextResponse.json({error:"Bolão indisponível."},{status:404});

    const opensAt=new Date(pool.payment_deadline).getTime();
    if(Number.isFinite(opensAt)&&Date.now()>=opensAt){
      return NextResponse.json({error:"Os pagamentos já foram abertos."},{status:409});
    }

    const {error}=await s.from("timer_push_subscriptions").upsert({
      pool_id:pool.id,
      endpoint:subscription.endpoint,
      p256dh:subscription.keys.p256dh,
      auth:subscription.keys.auth,
      enabled:true,
      updated_at:new Date().toISOString(),
    },{onConflict:"endpoint"});
    if(error)throw error;
    return NextResponse.json({ok:true});
  }catch{
    return NextResponse.json({error:"Não foi possível ativar o lembrete do temporizador."},{status:500});
  }
}
