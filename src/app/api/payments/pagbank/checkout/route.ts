import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_POOL_RULES_VERSION } from "@/lib/pool-rules";
import { fetchPagBank, pagBankToken } from "@/lib/pagbank";

const phoneKey = (value: string) => value.replace(/\D/g, "");

export async function POST(request: Request) {
  if (!pagBankToken()) return NextResponse.json({error:"O PagBank ainda não está configurado."},{status:503});
  const body=await request.json().catch(()=>null) as {token?:string}|null, token=String(body?.token||"");
  if(!token)return NextResponse.json({error:"Participante inválido."},{status:400});
  const s=createAdminClient(),{data:p}=await s.from("participants").select("id,pool_id,name,phone,email,shares,status,payment_status,is_test,test_amount_cents").eq("access_token",token).maybeSingle();
  if(!p||p.status!=="confirmed")return NextResponse.json({error:"Esta participação não está disponível para pagamento."},{status:404});
  if(p.payment_status==="confirmed")return NextResponse.json({error:"Esta cota já está paga."},{status:409});
  const{data:pool}=await s.from("pools").select("id,owner_id,title,share_price_cents,payment_opens_at,payment_deadline,rules_version").eq("id",p.pool_id).maybeSingle();
  if(!pool)return NextResponse.json({error:"Bolão não encontrado."},{status:404});
  const now=Date.now(),opens=pool.payment_opens_at?new Date(pool.payment_opens_at).getTime():0,closes=pool.payment_deadline?new Date(pool.payment_deadline).getTime():0;
  if(!p.is_test&&opens&&now<opens)return NextResponse.json({error:"Os pagamentos deste bolão ainda não foram abertos."},{status:403});
  if(!p.is_test&&closes&&now>closes)return NextResponse.json({error:"O prazo de pagamento foi encerrado."},{status:403});
  const version=Number(pool.rules_version||DEFAULT_POOL_RULES_VERSION),{data:acceptance}=await s.from("pool_rule_acceptances").select("id").eq("pool_id",pool.id).eq("participant_id",p.id).eq("rules_version",version).maybeSingle();
  if(!acceptance)return NextResponse.json({error:"Aceite as Regras do Bolão antes de gerar o pagamento."},{status:403});
  const{data:existing}=await s.from("payment_checkout_sessions").select("provider_order_id,qr_code_text,qr_code_expires_at").eq("participant_id",p.id).eq("provider","pagbank").in("status",["creating","pending","processing"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing?.qr_code_text&&(!existing.qr_code_expires_at||new Date(existing.qr_code_expires_at).getTime()>now))return NextResponse.json({orderId:existing.provider_order_id,qrCodeText:existing.qr_code_text,qrCodeImage:await QRCode.toDataURL(existing.qr_code_text,{width:360,margin:1}),expiresAt:existing.qr_code_expires_at,reused:true});
  const gross=p.is_test?Number(p.test_amount_cents||100):Number(p.shares)*Number(pool.share_price_cents);let credit=0;
  if(!p.is_test&&p.phone){const{data:a}=await s.from("participant_credit_accounts").select("balance_cents").eq("owner_id",pool.owner_id).eq("phone",phoneKey(p.phone)).maybeSingle();credit=Number(a?.balance_cents||0)}
  const creditUsed=Math.min(gross,credit),due=gross-creditUsed;
  if(due<=0)return NextResponse.json({error:"Sua participação está totalmente coberta pelo crédito. O organizador fará a confirmação."},{status:409});
  const referenceId=`bolao-${p.id}-${crypto.randomUUID().slice(0,12)}`,origin=new URL(request.url).origin,expiration=new Date(Date.now()+30*60*1000).toISOString();
  const{error:insertError}=await s.from("payment_checkout_sessions").insert({pool_id:pool.id,participant_id:p.id,provider:"pagbank",order_nsu:referenceId,gross_amount_cents:gross,credit_used_cents:creditUsed,expected_amount_cents:due,status:"creating",is_test:p.is_test});
  if(insertError)return NextResponse.json({error:"Já existe uma cobrança ativa. Atualize a página e tente novamente."},{status:409});
  const customerPhone=phoneKey(p.phone||"");
  const response=await fetchPagBank("/orders",{method:"POST",body:JSON.stringify({reference_id:referenceId,customer:{name:p.name,...(p.email?{email:p.email}:{}),...(customerPhone.length>=10?{phones:[{country:"55",area:customerPhone.slice(0,2),number:customerPhone.slice(2),type:"MOBILE"}]}:{})},items:[{reference_id:`cota-${p.id}`,name:p.is_test?"Teste Bolão Amigos BTP":`${p.shares} cota(s) - ${pool.title}`,quantity:1,unit_amount:due}],qr_codes:[{amount:{value:due},expiration_date:expiration}],notification_urls:[`${origin}/api/webhooks/pagbank`]}),headers:{"x-idempotency-key":referenceId}});
  const result=await response.json().catch(()=>null) as Record<string,any>|null,qr=Array.isArray(result?.qr_codes)?result!.qr_codes[0]:null;
  if(!response.ok||!result?.id||!qr?.text){await s.from("payment_checkout_sessions").update({status:"failed",failure_reason:`pagbank_${response.status}`,updated_at:new Date().toISOString()}).eq("order_nsu",referenceId);console.error("PagBank order failed",{status:response.status,result});return NextResponse.json({error:"O PagBank não conseguiu gerar o QR Code agora."},{status:502})}
  await s.from("payment_checkout_sessions").update({provider_order_id:result.id,qr_code_text:qr.text,qr_code_expires_at:qr.expiration_date||expiration,status:"pending",updated_at:new Date().toISOString()}).eq("order_nsu",referenceId);
  return NextResponse.json({orderId:result.id,qrCodeText:qr.text,qrCodeImage:await QRCode.toDataURL(qr.text,{width:360,margin:1}),expiresAt:qr.expiration_date||expiration});
}
