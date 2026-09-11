import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
const phoneKey=(v:string)=>v.replace(/\D/g,"");
const kindLabel:Record<string,string>={credit:"Crédito recebido",prize:"Prêmio convertido em crédito",manual:"Crédito manual",adjustment:"Ajuste de saldo",use:"Crédito utilizado"};

export default async function ParticipantWallet({params}:{params:Promise<{token:string}>}){
  const{token}=await params;
  const s=createAdminClient();
  const{data:p}=await s.from("participants").select("id,pool_id,name,phone,shares,status,payment_status,is_test,test_amount_cents").eq("access_token",token).maybeSingle();
  if(!p||p.status==="cancelled")return <main className="shell"><section className="section"><h1>Carteira indisponível</h1><p className="muted">Este link de participante não é válido.</p></section></main>;
  const{data:pool}=await s.from("pools").select("owner_id,title,share_price_cents").eq("id",p.pool_id).maybeSingle();
  if(!pool)return <main className="shell"><section className="section"><h1>Carteira indisponível</h1></section></main>;
  let account:any=null,history:any[]=[];
  if(p.phone){
    const{data:a}=await s.from("participant_credit_accounts").select("id,balance_cents").eq("owner_id",pool.owner_id).eq("phone",phoneKey(p.phone)).maybeSingle();
    account=a;
    if(a?.id){const{data:h}=await s.from("participant_credit_ledger").select("id,amount_cents,kind,description,created_at").eq("account_id",a.id).order("created_at",{ascending:false}).limit(30);history=h??[]}
  }
  const isTest=Boolean(p.is_test);
  const amount=isTest?Number(p.test_amount_cents||100):Number(p.shares)*Number(pool.share_price_cents);
  const{data:payment}=await s.from("payments").select("gross_amount_cents,credit_used_cents,amount_cents,confirmed_at").eq("participant_id",p.id).eq("status","confirmed").order("confirmed_at",{ascending:false}).limit(1).maybeSingle();
  const balance=Number(account?.balance_cents||0);
  const paid=p.payment_status==="confirmed";
  const applied=paid?Number(payment?.credit_used_cents||0):(isTest?0:Math.min(amount,balance));
  const due=paid?0:Math.max(0,amount-applied);
  const afterPayment=paid?balance:Math.max(0,balance-applied);
  return <main className="shell">
    <Link className="back" href={`/p/${token}`}>← Voltar</Link>
    <section className="section">
      <p className="eyebrow">ÁREA DO PARTICIPANTE</p>
      <h1>💳 Minha Carteira</h1>
      <p><strong>{p.name}</strong> · {pool.title}</p>
      {isTest&&<p className="muted">Modo teste: o pagamento de teste não movimenta o seu saldo real.</p>}
      <div className="wallet">
        <div className="wallet-row"><span>Saldo disponível</span><strong>{money(balance)}</strong></div>
        <div className="wallet-row"><span>Valor desta participação</span><strong>{money(amount)}</strong></div>
        <div className="wallet-row"><span>Crédito aplicado</span><strong>{money(applied)}</strong></div>
        <div className="wallet-row"><span>Valor a pagar</span><strong>{money(due)}</strong></div>
        <div className="wallet-row"><span>Saldo após esta participação</span><strong>{money(afterPayment)}</strong></div>
      </div>
      {paid&&<p className="status">✓ Pagamento confirmado</p>}
    </section>
    <section className="section">
      <h2>Histórico de créditos</h2>
      {history.length?<div className="list">{history.map(i=><div className="list-item" key={i.id}><div><strong>{kindLabel[i.kind]||i.description||i.kind}</strong><div className="muted">{new Date(i.created_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</div></div><strong style={{color:Number(i.amount_cents)>=0?"#ffd54a":"#fff"}}>{Number(i.amount_cents)>=0?"+ ":"- "}{money(Math.abs(Number(i.amount_cents)))}</strong></div>)}</div>:<p className="muted">Nenhuma movimentação de crédito registrada.</p>}
      <p className="muted">A carteira registra créditos para abatimento em bolões. Ela não guarda nem transfere dinheiro.</p>
    </section>
    <Link className="button secondary" href={`/p/${token}`}>VOLTAR PARA MINHA PARTICIPAÇÃO</Link>
  </main>
}
