import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {fetchPagBank,pagBankOrderPaid} from "@/lib/pagbank";
import {sendPaymentConfirmedPush} from "@/lib/send-payment-push";

const phoneKey=(v:string)=>v.replace(/\D/g,"");

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as {token?:string}|null,token=String(body?.token||"");
  if(!token)return NextResponse.json({error:"Participante inválido."},{status:400});
  const s=createAdminClient(),{data:p}=await s.from("participants").select("id,pool_id,name,phone,shares,status,payment_status").eq("access_token",token).maybeSingle();
  if(!p)return NextResponse.json({error:"Participante inválido."},{status:404});
  if(p.payment_status==="confirmed")return NextResponse.json({paid:true});
  const{data:session}=await s.from("payment_checkout_sessions").select("id,provider_order_id,order_nsu,gross_amount_cents,credit_used_cents,expected_amount_cents,is_test,status").eq("participant_id",p.id).eq("provider","pagbank").in("status",["pending","processing","review_required"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!session?.provider_order_id)return NextResponse.json({paid:false});
  const response=await fetchPagBank(`/orders/${encodeURIComponent(session.provider_order_id)}`),order=await response.json().catch(()=>null) as Record<string,any>|null;
  if(!response.ok||!order)return NextResponse.json({error:"Não foi possível consultar o Pix."},{status:502});
  if(!pagBankOrderPaid(order))return NextResponse.json({paid:false,status:"pending"});
  const charge=Array.isArray(order.charges)?order.charges.find((x:any)=>String(x?.status).toUpperCase()==="PAID"):null,transactionId=String(charge?.id||session.provider_order_id);
  const{data:claimed}=await s.from("payment_checkout_sessions").update({status:"processing",transaction_nsu:transactionId,paid_amount_cents:session.expected_amount_cents,updated_at:new Date().toISOString()}).eq("id",session.id).eq("status","pending").select("id").maybeSingle();
  if(!claimed){const{data:latest}=await s.from("payment_checkout_sessions").select("status").eq("id",session.id).single();return NextResponse.json({paid:latest?.status==="paid",processing:true})}
  const{data:pool}=await s.from("pools").select("owner_id").eq("id",p.pool_id).single(),gross=Number(session.gross_amount_cents),cashPaid=Number(session.expected_amount_cents),creditUsed=Number(session.credit_used_cents);let account:any=null;
  if(!pool){await s.from("payment_checkout_sessions").update({status:"review_required",failure_reason:"pool_not_found"}).eq("id",session.id);return NextResponse.json({error:"Pagamento recebido; bolão não encontrado para atualização."},{status:409})}
  if(creditUsed&&p.phone){const{data}=await s.from("participant_credit_accounts").select("id,balance_cents").eq("owner_id",pool.owner_id).eq("phone",phoneKey(p.phone)).maybeSingle();account=data;if(!account||Number(account.balance_cents)<creditUsed){await s.from("payment_checkout_sessions").update({status:"review_required",failure_reason:"credit_balance_changed"}).eq("id",session.id);return NextResponse.json({error:"O saldo de crédito mudou. O organizador precisa revisar."},{status:409})}}
  const{data:payment,error}=await s.from("payments").insert({pool_id:p.pool_id,participant_id:p.id,amount_cents:cashPaid,gross_amount_cents:gross,credit_used_cents:creditUsed,status:"confirmed",payment_method:"pix",confirmed_at:new Date().toISOString(),provider:"pagbank",provider_reference:session.provider_order_id,provider_transaction_nsu:transactionId,is_test:session.is_test}).select().single();
  if(error){await s.from("payment_checkout_sessions").update({status:"review_required",failure_reason:error.code||"payment_insert_failed"}).eq("id",session.id);return NextResponse.json({error:"Pagamento recebido; atualização em revisão."},{status:500})}
  try{
    if(!session.is_test){await s.from("wallet_transactions").insert({pool_id:p.pool_id,payment_id:payment.id,type:"payment_confirmed",amount_cents:cashPaid,shares:Number(p.shares),description:"Pagamento confirmado automaticamente via PagBank",created_by:pool.owner_id})}
    if(!session.is_test&&creditUsed){await s.from("participant_credit_accounts").update({balance_cents:Number(account.balance_cents)-creditUsed,updated_at:new Date().toISOString()}).eq("id",account.id);await s.from("participant_credit_ledger").insert({owner_id:pool.owner_id,pool_id:p.pool_id,participant_id:p.id,kind:"use",amount_cents:-creditUsed,description:"Crédito usado no pagamento via PagBank",created_by:pool.owner_id})}
    await s.from("participants").update({payment_status:"confirmed"}).eq("id",p.id).in("payment_status",["pending","partial"]);
  }catch{await s.from("payment_checkout_sessions").update({status:"review_required",failure_reason:"financial_write_failed"}).eq("id",session.id);return NextResponse.json({error:"Pagamento recebido; atualização financeira em revisão."},{status:500})}
  await s.from("payment_checkout_sessions").update({status:"paid",paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",session.id);
  await s.from("payment_submissions").update({status:"approved",reviewed_at:new Date().toISOString()}).eq("participant_id",p.id).eq("status","pending");
  await s.from("audit_events").insert({pool_id:p.pool_id,actor_id:pool.owner_id,event_type:session.is_test?"test_payment_confirmed":"payment_confirmed_automatically",entity_type:"payment",entity_id:payment.id,details:{participant_id:p.id,participant_name:p.name,provider:"pagbank",order_id:session.provider_order_id,transaction_id:transactionId,gross_amount_cents:gross,cash_paid_cents:cashPaid,credit_used_cents:creditUsed,is_test:session.is_test}});
  try{await sendPaymentConfirmedPush({participantId:p.id,amountCents:cashPaid})}catch(error){console.error("Falha no push PagBank",error)}
  return NextResponse.json({paid:true});
}
