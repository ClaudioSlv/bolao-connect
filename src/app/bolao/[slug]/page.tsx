import { createClient } from "@/lib/supabase/server";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
export const dynamic="force-dynamic";

export default async function PublicPool({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const supabase=await createClient();
 const {data:pool}=await supabase.from("pools").select("id,title,lottery,contest_number,estimated_prize_cents,share_price_cents,payment_deadline,draw_at,status").eq("public_slug",slug).maybeSingle();
 if(!pool)return <main className="shell"><section className="section"><h1>Bolão não encontrado</h1><p className="muted">Confira se o link recebido está correto.</p></section></main>;
 return <main className="shell"><section className="section"><p className="eyebrow">BOLÃO CONNECT</p><h1>🍀 {pool.title}</h1><p className="muted">{pool.lottery}{pool.contest_number?` · Concurso ${pool.contest_number}`:""}</p></section>
 <section className="section"><div className="wallet"><div className="wallet-row"><span>Valor da cota</span><strong>{money(Number(pool.share_price_cents))}</strong></div>{pool.estimated_prize_cents?<div className="wallet-row"><span>Prêmio estimado</span><strong>{money(Number(pool.estimated_prize_cents))}</strong></div>:null}<div className="wallet-row"><span>Prazo para pagamento</span><strong>{new Date(pool.payment_deadline).toLocaleDateString("pt-BR")}</strong></div>{pool.draw_at?<div className="wallet-row"><span>Sorteio</span><strong>{new Date(pool.draw_at).toLocaleDateString("pt-BR")}</strong></div>:null}</div></section>
 <section className="section"><h2>Pagamento por Pix</h2><div className="card"><strong>Chave Pix telefone</strong><span>13 99132-0205</span></div><div className="card"><strong>Chave Pix CPF</strong><span>281.649.638-44</span></div><p className="muted">Depois do pagamento, envie o comprovante ao organizador. O pagamento só fica como confirmado após a conferência do organizador.</p></section>
 <section className="section"><h2>Enviar comprovante pelo Bolão Connect</h2><p className="muted">O envio direto pelo link será liberado para participantes identificados. Enquanto isso, o comprovante também pode ser enviado pelo WhatsApp ao organizador.</p></section>
 </main>;
}
