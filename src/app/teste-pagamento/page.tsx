import Link from "next/link";
import {redirect} from "next/navigation";
import {AppNav} from "@/components/app-nav";
import {createTestParticipant} from "@/app/actions/participants";
import {createClient} from "@/lib/supabase/server";

export const dynamic="force-dynamic";

async function createTest(form:FormData){"use server";const poolId=String(form.get("poolId")??"");const participant=await createTestParticipant(poolId);redirect(`/teste-pagamento/${participant.access_token}`)}

export default async function TestPayment(){
  const s=await createClient(),{data:auth}=await s.auth.getUser();
  if(!auth.user)return <main className="shell"><section className="section"><h1>Teste InfinitePay</h1><p>Entre como organizador para continuar.</p><Link className="button primary" href="/login">Entrar</Link></section></main>;
  const{data:pools}=await s.from("pools").select("id,title,lottery").eq("owner_id",auth.user.id).order("created_at",{ascending:false});
  return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><p className="eyebrow">MODO DE TESTE</p><h1>🧪 Testar InfinitePay</h1><p className="muted">Crie um cliente de teste com cobrança real de R$ 1,00. Ele não ocupa cota e não entra na arrecadação do bolão.</p></section><section className="section list">{!pools?.length?<p className="muted">Crie um bolão antes de iniciar o teste.</p>:pools.map(pool=><form className="card test-payment-pool" action={createTest} key={pool.id}><input type="hidden" name="poolId" value={pool.id}/><strong>{pool.title}</strong><span>{pool.lottery}</span><button className="button primary">CRIAR CLIENTE TESTE · R$ 1,00</button></form>)}</section><AppNav/></main>;
}
