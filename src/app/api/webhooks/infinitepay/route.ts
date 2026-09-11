import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {sendPaymentConfirmedPush} from "@/lib/send-payment-push";

type Payload={invoice_slug?:string;order_nsu?:string;transaction_nsu?:string};
const phoneKey=(v:string)=>v.replace(/\D/g,"");

export async function POST(request:Request){
  const handle=process.env.INFINITEPAY_HANDLE;
  if(!handle)return NextResponse.json({error:"Integração não configurada."},{status:503});
  const payload=await request.json().catch(()=>null) as Payload|null;
  if(!payload?.order_nsu||!payload.transaction_nsu||!payload.invoice_slug)return NextResponse.json({error:"Dados de pagamento incompletos."},{status:400});
  const s=createAdminClient(),{data:session}=await s.from("payment_checkout_sessions").select("id,pool_id,participant_id,order_nsu,gross_amount_cents,credit_used_cents,expected_amount_cents,status,is_test").eq("provider","infinitepay").eq("order_nsu",payload.order_nsu).maybeSingle();
  if(!session)return NextResponse.json({error:"Cobrança não encontrada."},{status:400});
  if(session.status==="paid")return NextResponse.json({received:true,duplicate:true});
  const verification=await fetch("https://api.checkout.infinitepay.io/payment_check",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({handle,order_nsu:payload.order_nsu,transaction_nsu:payload.transaction_nsu,slug:payload.invoice_slug})});
  const checked=await verification.json().catch(()=>null) as {paid?:boolean;amount?:number}|null;
  if(!verification.ok||!checked?.paid||Number(checked.amount)!==Number(session.expected_amount_cents))return NextResponse.json({error:"Pagamento ainda não confirmado ou valor diferente."},{status:400});
  const{data:claimed}=await s.from("payment_checkout_sessions").update({status:"processing",transaction_nsu:payload.transaction_nsu,invoice_slug:payload.invoice_slug,paid_amount_cents:checked.amount,updated_at:new Date().toISOString()}).eq("id",session.id).in("status",["creating","pending","failed"]).select("id").maybeSingle();
  if(!claimed){const{data:latest}=await s.from("payment_checkout_sessions").select("status").eq("id",session.id).single();return latest?.status==="paid"?NextResponse.json({received:true,duplicate:true}):NextResponse.json({error:"Pagamento em processamento."},{status:409})}
  const{data:p}=await s.from("participants").select("id,name,phone,shares,status,payment_status").eq("id",session.participant_id).eq("pool_id",session.pool_id).maybeSingle(),{data:pool}=await s.from("pools").select("owner_id,share_price_cents").eq("id",session.pool_id).maybeSingle();
  if(!p||!pool||p.status!=="confirmed"){await s.from("payment_checkout_sessions").update({status:"failed",failure_reason:"participant_unavailable"}).eq("id",session.id);return NextResponse.json({error:"Participante indisponível."},{status:409})}
  if(p.payment_status==="confirmed"){await s.from("payment_checkout_sessions").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",session.id);return NextResponse.json({received:true,duplicate:true})}
  const gross=Number(session.gross_amount_cents),cashPaid=Number(session.expected_amount_cents),creditUsed=Number(session.credit_used_cents);let account:any=null;
  if(creditUsed&&p.phone){const{data}=await s.from("participant_credit_accounts").select("id,balance_cents").eq("owner_id",pool.owner_id).eq("phone",phoneKey(p.phone)).maybeSingle();account=data;if(!account||Number(account.balance_cents)<creditUsed){await s.from("payment_checkout_sessions").update({status:"review_required",failure_reason:"credit_balance_changed"}).eq("id",session.id);return NextResponse.json({error:"O saldo de crédito mudou. Revisão necessária."},{status:409})}}
  const{data:payment,error:paymentError}=await s.from("payments").insert({pool_id:session.pool_id,participant_id:p.id,amount_cents:cashPaid,gross_amount_cents:gross,credit_used_cents:creditUsed,status:"confirmed",payment_method:"pix",confirmed_at:new Date().toISOString(),provider:"infinitepay",provider_reference:session.order_nsu,provider_transaction_nsu:payload.transaction_nsu,is_test:session.is_test}).select().single();
  if(paymentError){await s.from("payment_checkout_sessions").update({status:"failed",failure_reason:paymentError.code||"payment_insert_failed"}).eq("id",session.id);return NextResponse.json({error:"Não foi possível registrar o pagamento."},{status:500})}
  try{
    if(account&&creditUsed){const balance=Number(account.balance_cents);const{error:u}=await s.from("participant_credit_accounts").update({balance_cents:balance-creditUsed,updated_at:new Date().toISOString()}).eq("id",account.id).eq("balance_cents",balance);if(u)throw u;const{error:l}=await s.from("participant_credit_ledger").insert({account_id:account.id,pool_id:session.pool_id,participant_id:p.id,amount_cents:-creditUsed,kind:"use",description:`Crédito utilizado no bolão por ${p.name}`,created_by:pool.owner_id});if(l)throw l}
    if(!session.is_test){const{error:w}=await s.from("wallet_transactions").insert({pool_id:session.pool_id,payment_id:payment.id,type:"payment_confirmed",amount_cents:cashPaid,shares:Number(p.shares),description:"Pagamento confirmado automaticamente via InfinitePay",created_by:pool.owner_id});if(w)throw w;}
    if(!session.is_test&&creditUsed){const{error:cw}=await s.from("wallet_transactions").insert({pool_id:session.pool_id,payment_id:payment.id,type:"credit_used",amount_cents:creditUsed,shares:0,description:`Crédito abatido de ${p.name}`,created_by:pool.owner_id});if(cw)throw cw}
    const{error:participantError}=await s.from("participants").update({payment_status:"confirmed"}).eq("id",p.id).in("payment_status",["pending","partial"]);if(participantError)throw participantError;
  }catch(error){await s.from("wallet_transactions").delete().eq("payment_id",payment.id);await s.from("participant_credit_ledger").delete().eq("pool_id",session.pool_id).eq("participant_id",p.id).eq("kind","use");if(account&&creditUsed)await s.from("participant_credit_accounts").update({balance_cents:account.balance_cents}).eq("id",account.id);await s.from("payments").delete().eq("id",payment.id);await s.from("payment_checkout_sessions").update({status:"review_required",failure_reason:"financial_write_failed"}).eq("id",session.id);return NextResponse.json({error:"Não foi possível concluir a atualização financeira."},{status:500})}
  await s.from("payment_checkout_sessions").update({status:"paid",paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",session.id);
  await s.from("payment_submissions").update({status:"approved",reviewed_at:new Date().toISOString()}).eq("participant_id",p.id).eq("status","pending");
  await s.from("audit_events").insert({pool_id:session.pool_id,actor_id:pool.owner_id,event_type:session.is_test?"test_payment_confirmed":"payment_confirmed_automatically",entity_type:"payment",entity_id:payment.id,details:{participant_id:p.id,participant_name:p.name,provider:"infinitepay",order_nsu:session.order_nsu,transaction_nsu:payload.transaction_nsu,gross_amount_cents:gross,cash_paid_cents:cashPaid,credit_used_cents:creditUsed,is_test:session.is_test}});
  try{await sendPaymentConfirmedPush({participantId:p.id,amountCents:cashPaid})}catch(error){console.error("Falha ao enviar confirmação de pagamento",error)}
  return NextResponse.json({received:true});
}
