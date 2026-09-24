import {NextResponse} from "next/server";
import QRCode from "qrcode";
import {createAdminClient} from "@/lib/supabase/admin";
import {DEFAULT_POOL_RULES_VERSION} from "@/lib/pool-rules";
import {efiConfigured,efiRequest} from "@/lib/efi";
const digits=(v:string)=>v.replace(/\D/g,"");
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  if(!efiConfigured())return NextResponse.json({error:"A Efí ainda não está configurada."},{status:503});
  const body=await request.json().catch(()=>null) as {token?:string}|null,token=String(body?.token||"");
  if(!token)return NextResponse.json({error:"Participante inválido."},{status:400});
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("id,pool_id,name,phone,shares,status,payment_status,is_test,test_amount_cents,payment_deadline_override").eq("access_token",token).maybeSingle();
  if(!p||p.status!=="confirmed")return NextResponse.json({error:"Esta participação não está disponível para pagamento."},{status:404});
  if(p.payment_status==="confirmed")return NextResponse.json({error:"Esta cota já está paga."},{status:409});
  const {data:pool}=await s.from("pools").select("id,owner_id,title,share_price_cents,payment_opens_at,payment_deadline,rules_version").eq("id",p.pool_id).maybeSingle();
  if(!pool)return NextResponse.json({error:"Bolão não encontrado."},{status:404});
  const now=Date.now(),opens=pool.payment_opens_at?new Date(pool.payment_opens_at).getTime():0,closes=p.payment_deadline_override?new Date(p.payment_deadline_override).getTime():pool.payment_deadline?new Date(pool.payment_deadline).getTime():0;
  if(!p.is_test&&opens&&now<opens)return NextResponse.json({error:"Os pagamentos deste bolão ainda não foram abertos."},{status:403});
  if(!p.is_test&&closes&&now>closes)return NextResponse.json({error:"O prazo de pagamento foi encerrado."},{status:403});
  const version=Number(pool.rules_version||DEFAULT_POOL_RULES_VERSION),{data:acceptance}=await s.from("pool_rule_acceptances").select("id").eq("pool_id",pool.id).eq("participant_id",p.id).eq("rules_version",version).maybeSingle();
  if(!acceptance)return NextResponse.json({error:"Aceite as Regras do Bolão antes de gerar o pagamento."},{status:403});
  const {data:existing}=await s.from("payment_checkout_sessions").select("provider_order_id,qr_code_text,qr_code_expires_at").eq("participant_id",p.id).eq("provider","efi").in("status",["creating","pending","processing"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing?.qr_code_text&&(!existing.qr_code_expires_at||new Date(existing.qr_code_expires_at).getTime()>now))return NextResponse.json({orderId:existing.provider_order_id,qrCodeText:existing.qr_code_text,qrCodeImage:await QRCode.toDataURL(existing.qr_code_text,{width:360,margin:1}),expiresAt:existing.qr_code_expires_at,reused:true});
  // A previous attempt can leave an active row in "creating" without a QR code.
  // Release that orphan before creating a replacement, otherwise the partial unique
  // index rejects the new checkout and the participant gets stuck on HTTP 409.
  if(existing&&!existing.qr_code_text){
   await s.from("payment_checkout_sessions").update({status:"failed",failure_reason:"efi_orphan_without_qr_replaced",updated_at:new Date().toISOString()}).eq("participant_id",p.id).eq("provider","efi").in("status",["creating","pending","processing"]);
  }
  const gross=p.is_test?Number(p.test_amount_cents||100):Number(p.shares)*Number(pool.share_price_cents);let credit=0;
  if(!p.is_test&&p.phone){const {data:a}=await s.from("participant_credit_accounts").select("balance_cents").eq("owner_id",pool.owner_id).eq("phone",digits(p.phone)).maybeSingle();credit=Number(a?.balance_cents||0)}
  const creditUsed=Math.min(gross,credit),due=gross-creditUsed;
  if(due<=0)return NextResponse.json({error:"Sua participação está totalmente coberta pelo crédito."},{status:409});
  const referenceId=`efi-${p.id}-${crypto.randomUUID().slice(0,12)}`,expirationSeconds=1800,expiresAt=new Date(Date.now()+expirationSeconds*1000).toISOString();
  const {error:ie}=await s.from("payment_checkout_sessions").insert({pool_id:pool.id,participant_id:p.id,provider:"efi",order_nsu:referenceId,gross_amount_cents:gross,credit_used_cents:creditUsed,expected_amount_cents:due,status:"creating",is_test:Boolean(p.is_test)});
  if(ie){
   // Pode haver concorrência entre dois cliques/requisições: a outra requisição
   // cria a sessão primeiro. Recupere essa sessão em vez de mostrar erro ao participante.
   const {data:active}=await s.from("payment_checkout_sessions").select("provider_order_id,qr_code_text,qr_code_expires_at").eq("participant_id",p.id).eq("provider","efi").in("status",["creating","pending","processing"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(active?.qr_code_text&&(!active.qr_code_expires_at||new Date(active.qr_code_expires_at).getTime()>Date.now()))
    return NextResponse.json({orderId:active.provider_order_id,qrCodeText:active.qr_code_text,qrCodeImage:await QRCode.toDataURL(active.qr_code_text,{width:360,margin:1}),expiresAt:active.qr_code_expires_at,reused:true});
   if(active){
    for(let attempt=0;attempt<6;attempt++){
     await new Promise(resolve=>setTimeout(resolve,500));
     const {data:ready}=await s.from("payment_checkout_sessions").select("provider_order_id,qr_code_text,qr_code_expires_at").eq("participant_id",p.id).eq("provider","efi").in("status",["creating","pending","processing"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
     if(ready?.qr_code_text)
      return NextResponse.json({orderId:ready.provider_order_id,qrCodeText:ready.qr_code_text,qrCodeImage:await QRCode.toDataURL(ready.qr_code_text,{width:360,margin:1}),expiresAt:ready.qr_code_expires_at,reused:true});
    }
   }
   return NextResponse.json({error:"Sua cobrança está sendo gerada. Aguarde alguns segundos e tente novamente."},{status:409});
  }
  const charge=await efiRequest("/v2/cob",{method:"POST",body:{calendario:{expiracao:expirationSeconds},valor:{original:(due/100).toFixed(2)},chave:process.env.EFI_PIX_KEY,solicitacaoPagador:`Bolão Amigos BTP - ${pool.title}`,infoAdicionais:[{nome:"Participante",valor:String(p.name).slice(0,50)}]}});
  if(charge.status<200||charge.status>=300||!charge.data?.txid||!charge.data?.loc?.id){await s.from("payment_checkout_sessions").update({status:"failed",failure_reason:`efi_${charge.status}`,updated_at:new Date().toISOString()}).eq("order_nsu",referenceId);return NextResponse.json({error:charge.data?.mensagem||charge.data?.detail||`A Efí recusou a cobrança (HTTP ${charge.status}).`},{status:502})}
  const qr=await efiRequest(`/v2/loc/${charge.data.loc.id}/qrcode`);
  if(qr.status<200||qr.status>=300||!qr.data?.qrcode){await s.from("payment_checkout_sessions").update({status:"failed",provider_order_id:charge.data.txid,failure_reason:`efi_qr_${qr.status}`,updated_at:new Date().toISOString()}).eq("order_nsu",referenceId);return NextResponse.json({error:qr.data?.mensagem||"Cobrança criada, mas não foi possível gerar o QR Code. Verifique o escopo Consultar locations na Efí."},{status:502})}
  await s.from("payment_checkout_sessions").update({provider_order_id:charge.data.txid,qr_code_text:qr.data.qrcode,qr_code_expires_at:expiresAt,status:"pending",updated_at:new Date().toISOString()}).eq("order_nsu",referenceId);
  return NextResponse.json({orderId:charge.data.txid,qrCodeText:qr.data.qrcode,qrCodeImage:await QRCode.toDataURL(qr.data.qrcode,{width:360,margin:1}),expiresAt});
 }catch(e){console.error("Efi checkout",e);return NextResponse.json({error:e instanceof Error?e.message:"Falha ao gerar Pix Efí."},{status:500})}
}