import { createServerSupabaseClient } from "@/lib/supabase/server";

function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }

export default async function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: pool }, { data: entries }] = await Promise.all([
    supabase.from("pools").select("title,total_shares,share_price_cents").eq("id", id).single(),
    supabase.from("wallet_transactions").select("id,type,amount_cents,shares,description,created_at").eq("pool_id", id).order("created_at", { ascending: false }),
  ]);
  if (!pool) return <main className="screen"><div className="card">Bolão não encontrado.</div></main>;
  const confirmed = (entries ?? []).reduce((sum, item) => sum + (item.type === "payment_cancelled" ? -item.amount_cents : item.amount_cents), 0);
  const paidShares = (entries ?? []).reduce((sum, item) => sum + (item.type === "payment_cancelled" ? -item.shares : item.shares), 0);
  const target = pool.total_shares * pool.share_price_cents;
  const progress = target ? Math.min(100, Math.max(0, confirmed / target * 100)) : 0;

  return <main className="screen"><section className="hero"><span className="eyebrow">Carteira do Bolão</span><h1>{pool.title}</h1><p>Transparência da arrecadação para os participantes autorizados.</p></section>
    <section className="card"><span className="muted">Valor confirmado</span><strong className="big">{money(confirmed)}</strong><p>Meta {money(target)} · faltam {money(Math.max(0, target-confirmed))}</p><div className="progress"><span style={{ width: `${progress}%` }} /></div><p>{paidShares} cotas pagas · {Math.max(0,pool.total_shares-paidShares)} pendentes</p></section>
    <section className="card stack"><h2>Movimentações</h2>{(entries ?? []).length === 0 ? <p>Nenhuma movimentação confirmada.</p> : entries!.map((e) => <div className="listRow" key={e.id}><div><strong>{e.description || "Pagamento confirmado"}</strong><small>{new Date(e.created_at).toLocaleString("pt-BR")}</small></div><strong>{money(e.amount_cents)}</strong></div>)}</section>
  </main>;
}
