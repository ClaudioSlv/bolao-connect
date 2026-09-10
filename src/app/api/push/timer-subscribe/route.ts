import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {NEXT_POOL_PRELAUNCH} from "@/lib/next-pool";

export async function POST(req:Request){
  try{
    const body=await req.json();
    const slug=String(body.slug??"").trim();
    const campaignKey=String(body.campaignKey??"").trim();
    const subscription=body.subscription;
    if((!slug&&!campaignKey)||!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth){
      return NextResponse.json({error:"Dados inválidos."},{status:400});
    }

    const s=createAdminClient();

    if(campaignKey){
      if(campaignKey!==NEXT_POOL_PRELAUNCH.key)return NextResponse.json({error:"Campanha indisponível."},{status:404});
      const opensAt=new Date(NEXT_POOL_PRELAUNCH.opensAt).getTime();
      if(Number.isFinite(opensAt)&&Date.now()>=opensAt)return NextResponse.json({error:"A pré-abertura já terminou."},{status:409});
      const {error}=await s.from("prelaunch_push_subscriptions").upsert({
        campaign_key:campaignKey,
        endpoint:subscription.endpoint,
        p256dh:subscription.keys.p256dh,
        auth:subscription.keys.auth,
        enabled:true,
        updated_at:new Date().toISOString(),
      },{onConflict:"endpoint"});
      if(error)throw error;
      return NextResponse.json({ok:true,mode:"prelaunch"});
    }

    const {data:pool,error:poolError}=await s.from("pools").select("id,status,payment_deadline,public_slug").eq("public_slug",slug).maybeSingle();
    if(poolError)throw poolError;
    if(!pool||pool.status!=="open")return NextResponse.json({error:"Bolão indisponível."},{status:404});

    const opensAt=new Date(pool.payment_deadline).getTime();
    if(Number.isFinite(opensAt)&&Date.now()>=opensAt){
      return NextResponse.json({error:"Os pagamentos já foram abertos."},{status:409});
    }

    const now=new Date().toISOString();
    const {error}=await s.from("timer_push_subscriptions").upsert({
      pool_id:pool.id,
      endpoint:subscription.endpoint,
      p256dh:subscription.keys.p256dh,
      auth:subscription.keys.auth,
      enabled:true,
      updated_at:now,
    },{onConflict:"endpoint"});
    if(error)throw error;

    // Se este aparelho já foi vinculado a um participante deste mesmo bolão,
    // mantenha também o vínculo individual ativo. Assim a ativação/renovação
    // pelo temporizador não faz o cartão do participante aparecer como inativo.
    const {error:participantPushError}=await s.from("push_subscriptions").update({
      p256dh:subscription.keys.p256dh,
      auth:subscription.keys.auth,
      enabled:true,
      updated_at:now,
    }).eq("pool_id",pool.id).eq("endpoint",subscription.endpoint);
    if(participantPushError)throw participantPushError;

    return NextResponse.json({ok:true,mode:"pool"});
  }catch{
    return NextResponse.json({error:"Não foi possível ativar o lembrete do temporizador."},{status:500});
  }
}
