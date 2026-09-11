import Link from "next/link";
import {InfinitePayCheckout} from "@/components/infinitepay-checkout";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

export default async function TestClient({params}:{params:Promise<{token:string}>}){
  const{token}=await params,s=createAdminClient(),{data:p}=await s.from("participants").select("id,pool_id,name,payment_status,is_test,test_amount_cents").eq("access_token",token).eq("is_test",true).maybeSingle();
  if(!p)return <main className="shell"><section className="section"><h1>Teste não encontrado</h1></section></main>;
  const{data:pool}=await s.from("pools").select("title").eq("id",p.pool_id).maybeSingle(),paid=p.payment_status==="confirmed";
  return <main className="shell"><Link className="back" href="/teste-pagamento">← Voltar</Link><section className="section"><p className="eyebrow">MODO DE TESTE · INFINITEPAY</p><h1>🧪 {p.name}</h1><p className="muted">{pool?.title}</p><div className="card test-amount"><span>Valor real do teste</span><strong>R$ 1,00</strong><span>Não ocupa cota e não entra na arrecadação do bolão.</span></div></section>{paid?<section className="section"><div className="test-result-paid">✓ TESTE PAGO</div><p className="status">✅ RETORNO AUTOMÁTICO CONFIRMADO</p><p className="muted">A InfinitePay identificou a cobrança e o aplicativo atualizou este cliente automaticamente.</p></section>:<section className="section"><h2>Gerar cobrança</h2><InfinitePayCheckout token={token} amountLabel="R$ 1,00"/></section>}</main>;
}
