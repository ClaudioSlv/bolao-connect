import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {processEfiRefunds} from "@/lib/efi-refunds";

export const runtime="nodejs";

export async function POST(request:Request) {
  const body=await request.json().catch(()=>null) as {token?:string}|null;
  if (!body?.token) return NextResponse.json({error:"Token ausente."},{status:400});
  const s=createAdminClient();
  const {data:p}=await s.from("participants")
    .select("id,pool_id,is_test,payment_status,test_amount_cents")
    .eq("access_token",body.token).maybeSingle();
  if (!p?.is_test || p.payment_status!=="confirmed" || Number(p.test_amount_cents)!==500)
    return NextResponse.json({error:"Aguarde a confirmação do Pix de R$ 5,00."},{status:409});
  const {data:pool}=await s.from("pools").select("public_slug,rules_version").eq("id",p.pool_id).single();
  if (pool?.public_slug!=="teste-estorno-5-reais-20260929" || Number(pool.rules_version)!==6)
    return NextResponse.json({error:"Teste indisponível."},{status:403});
  const {data:existing}=await s.from("partial_payment_resolution_choices")
    .select("choice,status").eq("participant_id",p.id).maybeSingle();
  if (existing) {
    const progress=await processEfiRefunds(p.id);
    return NextResponse.json({ok:true,status:progress.status});
  }
  const {data:payments,error:paymentsError}=await s.from("payments")
    .select("amount_cents,credit_used_cents").eq("participant_id",p.id)
    .in("status",["partial","confirmed"]);
  if (paymentsError || (payments??[]).reduce((sum,row)=>sum+Number(row.amount_cents)+Number(row.credit_used_cents),0)!==500)
    return NextResponse.json({error:"Pagamento de teste não conciliado."},{status:409});
  const {error}=await s.from("partial_payment_resolution_choices")
    .insert({participant_id:p.id,pool_id:p.pool_id,choice:"refund",paid_cents:500,retention_cents:15,amount_cents:485});
  if (error && error.code!=="23505")
    return NextResponse.json({error:"Não foi possível iniciar o estorno."},{status:500});
  const progress=await processEfiRefunds(p.id);
  return NextResponse.json({ok:true,status:progress.status});
}
