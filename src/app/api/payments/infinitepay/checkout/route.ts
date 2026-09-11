import {NextResponse} from "next/server";
import QRCode from "qrcode";
import {createAdminClient} from "@/lib/supabase/admin";
import {DEFAULT_POOL_RULES_VERSION} from "@/lib/pool-rules";

const phoneKey=(v:string)=>v.replace(/\D/g,"");

export async function POST(request:Request){
  const handle=process.env.INFINITEPAY_HANDLE;
  if(!handle)return NextResponse.json({error:"A InfinitePay ainda não está configurada neste aplicativo."},{status:503});
  const body=await request.json().catch(()=>null) as {token?:string}|null,token=String(body?.token??"");
  if(!token)return NextResponse.json({error:"Participante inválido."},{status:400});
  const s=createAdminClient(),{data:p}=await s.from("participants").select("id,pool_id,name,phone,shares,status,payment_status,is_test,test_amount_cents").eq("access_token",token).maybeSingle();
  if(!p||p.status!=="confirmed")return NextResponse.json({error:"Esta participação não está disponível para pagamento."},{status:404});
  if(p.payment_status==="confirmed")return NextResponse.json({error:"Esta cota já está paga."},{status:409});
  const{data:pool}=await s.from("pools").select("id,owner_id,title,share_price_cents,payment_opens_at,payment_deadline,rules_version").eq("id",p.pool_id).maybeSingle();
  if(!pool)return NextResponse.json({error:"Bolão não encontrado."},{status:404});
  const now=Date.now(),opens=pool.payment_opens_at?new Date(pool.payment_opens_at).getTime():0,closes=pool.payment_deadline?new Date(pool.payment_deadline).getTime():0;
  if(!p.is_test&&opens&&now<opens)return NextResponse.json({error:"Os pagamentos deste bolão ainda não foram abertos."},{status:403});
  if(!p.is_test&&closes&&now>closes)return NextResponse.json({error:"O prazo de pagamento foi encerrado."},{status:403});
  const version=Number(pool.rules_version||DEFAULT_POOL_RULES_VERSION),{data:acceptance}=await s.from("pool_rule_acceptances").select("id").eq("pool_id",pool.id).eq("participant_id",p.id).eq("rules_version",version).maybeSingle();
  if(!p.is_test&&!acceptance)return NextResponse.json({error:"Aceite as Regras do Bolão antes de gerar o pagamento."},{status:403});
  const{data:existing}=await s.from("payment_checkout_sessions").select("checkout_url").eq("participant_id",p.id).in("status",["creating","pending","processing"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing?.checkout_url){const qrCode=await QRCode.toDataURL(existing.checkout_url,{width:480,margin:2});return NextResponse.json({checkoutUrl:existing.checkout_url,qrCode,reused:true})}
  const gross=p.is_test?Number(p.test_amount_cents||100):Number(p.shares)*Number(pool.share_price_cents);let credit=0;
  if(!p.is_test&&p.phone){const{data:account}=await s.from("participant_credit_accounts").select("balance_cents").eq("owner_id",pool.owner_id).eq("phone",phoneKey(p.phone)).maybeSingle();credit=Number(account?.balance_cents||0)}
  const creditUsed=Math.min(gross,credit),due=gross-creditUsed;
  if(due<=0)return NextResponse.json({error:"Sua participação está totalmente coberta pelo crédito. O organizador fará a confirmação."},{status:409});
  const orderNsu=`bolao-${p.id}-${crypto.randomUUID().slice(0,12)}`,origin=new URL(request.url).origin;
  const{error:insertError}=await s.from("payment_checkout_sessions").insert({pool_id:pool.id,participant_id:p.id,order_nsu:orderNsu,gross_amount_cents:gross,credit_used_cents:creditUsed,expected_amount_cents:due,status:"creating",is_test:p.is_test});
  if(insertError)return NextResponse.json({error:"Já existe uma cobrança sendo criada. Aguarde alguns segundos e tente novamente."},{status:409});
  const payment=await fetch("https://api.checkout.infinitepay.io/links",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({handle,items:[{quantity:1,price:due,description:p.is_test?"Teste Bolão Connect - R$ 1,00":`${p.shares} cota(s) - ${pool.title} - ${p.name}`}],order_nsu:orderNsu,redirect_url:p.is_test?`${origin}/teste-pagamento/${token}?payment=return`:`${origin}/p/${token}?payment=return`,webhook_url:`${origin}/api/webhooks/infinitepay`})});
  const response=await payment.json().catch(()=>null) as Record<string,unknown>|null,checkoutUrl=response?.url||response?.checkout_url||response?.link;
  if(!payment.ok||typeof checkoutUrl!=="string"){await s.from("payment_checkout_sessions").update({status:"failed",failure_reason:"provider_checkout_failed",updated_at:new Date().toISOString()}).eq("order_nsu",orderNsu);return NextResponse.json({error:"A InfinitePay não conseguiu gerar o pagamento agora."},{status:502})}
  await s.from("payment_checkout_sessions").update({checkout_url:checkoutUrl,status:"pending",updated_at:new Date().toISOString()}).eq("order_nsu",orderNsu);
  const qrCode=await QRCode.toDataURL(checkoutUrl,{width:480,margin:2});
  return NextResponse.json({checkoutUrl,qrCode});
}
