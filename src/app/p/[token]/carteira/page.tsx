import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {EfiCheckout} from "@/components/efi-checkout";

export const dynamic = "force-dynamic";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
const phoneKey=(v:string)=>v.replace(/\D/g,"");
const kindLabel:Record<string,string>={credit:"Crédito recebido",prize:"Prêmio convertido em crédito",manual:"Crédito manual",adjustment:"Ajuste de saldo",use:"Crédito utilizado"};

export default async function ParticipantWallet({params}:{params:Promise<{token:string}>}){
  const{token}=await params;
  const s=createAdminClient();
  const{data:p}=await s.from("participants").select("id,pool_id,name,phone,shares,status,payment_status,is_test,test_amount_cents,payment_deadline_override").eq("access_token",token).maybeSingle();
  if(!p||p.status==="cancelled")return <main className="shell"><section className="section"><h1>Carteira indisponível</h1><p className="muted">Este link de participante não é válido.</p></section></main>;
  const{data:pool}=await s.from("pools").select("owner_id,title,share_price_cents,payment_opens_at,payment_deadline,waitlist_payment_deadline,rules_version").eq("id",p.pool_id).maybeSingle();
  if(!pool)return <main className="shell"><section className="section"><h1>Carteira indisponível</h1></section></main>;
  let account:any=null,history:any[]=[];
  if(p.phone){
    const{data:a}=await s.from("participant_credit_accounts").select("id,balance_cents").eq("owner_id",pool.owner_id).eq("phone",phoneKey(p.phone)).maybeSingle();
    account=a;
    if(a?.id){const{data:h}=await s.from("participant_credit_ledger").select("id,amount_cents,kind,description,created_at").eq("account_id",a.id).order("created_at",{ascending:false}).limit(30);history=h??[]}
  }
  const isTest=Boolean(p.is_test);
  const amount=isTest?Number(p.test_amount_cents||100):Number(p.shares)*Number(pool.share_price_cents);
  const{data:payments}=await s.from("payments").select("credit_used_cents,amount_cents").eq("participant_id",p.id).in("status",["partial","confirmed"]);
  const{data:plan}=await s.from("participant_payment_plans").select("installment_count,total_amount_cents").eq("participant_id",p.id).maybeSingle();
  const balance=Number(account?.balance_cents||0);
  const paid=p.payment_status==="confirmed";
  const received=(payments??[]).reduce((sum,row)=>sum+Number(row.amount_cents||0),0);
  const appliedPayments=(payments??[]).reduce((sum,row)=>sum+Number(row.credit_used_cents||0),0);
  const paidTotal=received+appliedPayments;
  const due=paid?0:Math.max(0,amount-paidTotal);
  const schedule=plan?Array.from({length:Number(plan.installment_count)},(_,index)=>{const total=Number(plan.total_amount_cents),base=Math.floor(total/Number(plan.installment_count));return base+(index===Number(plan.installment_count)-1?total-base*Number(plan.installment_count):0)}):[];
  let accumulated=0,paidInstallments=0;
  while(paidInstallments<schedule.length&&accumulated+schedule[paidInstallments]<=paidTotal){accumulated+=schedule[paidInstallments];paidInstallments++}
  const remainingInstallments=schedule.slice(paidInstallments);
  const deadline=p.payment_deadline_override||pool.payment_deadline;
  const now=Date.now(),opens=pool.payment_opens_at?new Date(pool.payment_opens_at).getTime():0,closes=deadline?new Date(deadline).getTime():0;
  const paymentOpen=(!opens||now>=opens)&&(!closes||now<=closes);
  const automaticPixEnabled=Boolean(process.env.EFI_CLIENT_ID_PROD&&process.env.EFI_CLIENT_SECRET_PROD&&process.env.EFI_CERTIFICATE_BASE64&&process.env.EFI_PIX_KEY);
  return <main className="shell">
    <Link className="back" href={`/p/${token}`}>← Voltar</Link>
    <section className="section">
      <p className="eyebrow">ÁREA DO PARTICIPANTE</p>
      <h1>💳 Minha Carteira</h1>
      <p><strong>{p.name}</strong> · {pool.title}</p>
      {isTest&&<p className="muted">Modo teste: o pagamento de teste não movimenta o seu saldo real.</p>}
      <div className="wallet">
        <div className="wallet-row wallet-credit"><span>Crédito disponível</span><strong>{money(balance)}</strong></div>
        <div className="wallet-row"><span>Valor desta participação</span><strong>{money(amount)}</strong></div>
        {paid
          ? <div className="wallet-row wallet-paid"><span>Valor pago</span><strong>{money(amount)}</strong></div>
          : <div className="wallet-row wallet-pending"><span>Valor pendente</span><strong>{money(due)}</strong></div>}
        {appliedPayments>0&&<div className="wallet-row"><span>Crédito utilizado nesta cota</span><strong>{money(appliedPayments)}</strong></div>}
      </div>
      {paid&&<p className="status">✓ Pagamento confirmado</p>}
      {!paid&&paidTotal>0&&<p className="status">Pagamento parcial confirmado · falta {money(due)}</p>}
      <Link className="button secondary" href={`/p/${token}/comprovantes`}>
        📷 VER COMPROVANTES DOS JOGOS
      </Link>
    </section>
    {plan&&!paid&&<section className="section installment-wallet-card">
      <p className="eyebrow">PAGAMENTO PARCIAL</p>
      <h2>🧾 Pagar parcelas</h2>
      <p className="muted">Plano escolhido: <strong>{plan.installment_count}x</strong>. A cota será confirmada após a quitação total até {deadline?new Date(deadline).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"o prazo do bolão"}. Se não for quitada, a reserva poderá ser cancelada após a conferência dos valores pagos.</p>
      <div className="installment-list">{schedule.map((value,index)=>{const installmentPaid=index<paidInstallments;return <div className={installmentPaid?"installment-row paid":"installment-row pending"} key={index}><span>Parcela {index+1}</span><strong>{money(value)}</strong><b>{installmentPaid?"Paga":"Pendente"}</b></div>})}</div>
      {!paymentOpen&&<p className="status">O pagamento das parcelas não está disponível fora do prazo do bolão.</p>}
      {paymentOpen&&automaticPixEnabled&&remainingInstallments.length>0&&<EfiCheckout token={token} amountCents={due} creditCents={balance} installmentAmounts={remainingInstallments} paymentDeadline={deadline} refundRetentionPercent={Number(pool.rules_version)>=6?3:0}/>}
    </section>}
    <section className="section">
      <h2>Histórico de créditos</h2>
      {history.length?<div className="list">{history.map(i=><div className="list-item" key={i.id}><div><strong>{kindLabel[i.kind]||i.description||i.kind}</strong><div className="muted">{new Date(i.created_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</div></div><strong className={Number(i.amount_cents)>=0?"wallet-credit-text":"wallet-pending-text"}>{Number(i.amount_cents)>=0?"+ ":"- "}{money(Math.abs(Number(i.amount_cents)))}</strong></div>)}</div>:<p className="muted">Nenhuma movimentação de crédito registrada.</p>}
      <p className="muted">A carteira registra créditos para abatimento em bolões. Ela não guarda nem transfere dinheiro.</p>
    </section>
    <Link className="button secondary" href={`/p/${token}`}>VOLTAR PARA MINHA PARTICIPAÇÃO</Link>
  </main>
}
