import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const money=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);

export default async function Carteira(){
 const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser();
 if(!auth.user)return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>💰 Carteira do Bolão</h1><p className="muted">Entre na sua conta para visualizar a carteira.</p></section><AppNav/></main>;
 const {data:pool}=await supabase.from("pools").select("id,title,total_shares,share_price_cents").eq("owner_id",auth.user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(!pool)return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>💰 Carteira do Bolão</h1><p className="muted">Crie um bolão para começar a acompanhar a arrecadação.</p></section><AppNav/></main>;
 const [{data:participants},{data:allConfirmed},{data:movements}]=await Promise.all([
  supabase.from("participants").select("shares,payment_status,status").eq("pool_id",pool.id),
  supabase.from("wallet_transactions").select("amount_cents").eq("pool_id",pool.id).eq("type","payment_confirmed"),
  supabase.from("wallet_transactions").select("id,type,amount_cents,description,created_at").eq("pool_id",pool.id).order("created_at",{ascending:false}).limit(20)
 ]);
 let paidShares=0,pendingShares=0; for(const p of participants??[]){if(p.status==="cancelled")continue;const shares=Number(p.shares)||0;if(p.payment_status==="confirmed")paidShares+=shares;else pendingShares+=shares;}
 const target=Number(pool.total_shares)*Number(pool.share_price_cents); const confirmed=(allConfirmed??[]).reduce((s,i)=>s+(Number(i.amount_cents)||0),0); const missing=Math.max(0,target-confirmed); const progress=target>0?Math.min(100,Math.round(confirmed/target*100)):0;
 return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>💰 Carteira do Bolão</h1><p className="muted">{pool.title} · visão transparente da arrecadação.</p><div className="wallet"><div className="wallet-row"><span>Meta</span><strong>{money(target)}</strong></div><div className="wallet-row"><span>Confirmado</span><strong>{money(confirmed)}</strong></div><div className="wallet-row"><span>Falta arrecadar</span><strong>{money(missing)}</strong></div><div className="progress"><div style={{width:`${progress}%`}}/></div><div className="wallet-row"><span>{paidShares} cotas pagas</span><span>{pendingShares} pendentes</span></div></div></section><section className="section"><h2>Últimas movimentações</h2>{movements?.length?<div className="list">{movements.map(i=><div className="list-item" key={i.id}><div><strong>{i.description||i.type}</strong><div className="muted">{new Date(i.created_at).toLocaleDateString("pt-BR")}</div></div><strong>{money(Number(i.amount_cents)||0)}</strong></div>)}</div>:<p className="muted">Nenhuma movimentação registrada ainda.</p>}<p className="muted">A carteira é um registro de controle do bolão; não mantém ou movimenta dinheiro dos participantes.</p></section><AppNav/></main>;
}
