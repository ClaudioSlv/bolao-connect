import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function money(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: pool }, { data: participants }, { data: wallet }] = await Promise.all([
    supabase.from("pools").select("*").eq("id", id).single(),
    supabase.from("participants").select("id,name,shares,payment_status,status").eq("pool_id", id).order("created_at"),
    supabase.from("wallet_transactions").select("amount_cents,type").eq("pool_id", id),
  ]);

  if (!pool) return <main className="screen"><div className="card"><h1>Bolão não encontrado</h1></div></main>;
  const confirmed = (wallet ?? []).reduce((sum, item) => sum + (item.type === "payment_confirmed" ? item.amount_cents : item.type === "payment_cancelled" ? -item.amount_cents : item.amount_cents), 0);
  const target = pool.share_price_cents * pool.total_shares;

  return <main className="screen">
    <section className="hero"><span className="eyebrow">Painel do bolão</span><h1>{pool.title}</h1><p>{pool.lottery} · {pool.total_shares} cotas de {money(pool.share_price_cents)}</p></section>
    <section className="grid">
      <article className="card"><span className="muted">Carteira</span><strong className="big">{money(confirmed)}</strong><p>Meta: {money(target)}</p><Link className="primary linkButton" href={`/boloes/${id}/carteira`}>Ver carteira</Link></article>
      <article className="card"><span className="muted">Participantes</span><strong className="big">{participants?.length ?? 0}</strong><p>Cadastros neste bolão</p><Link className="primary linkButton" href={`/boloes/${id}/participantes`}>Gerenciar</Link></article>
      <article className="card"><span className="muted">Jogos</span><strong className="big">Conferência</strong><p>Cadastre jogos e acompanhe resultados.</p><Link className="primary linkButton" href={`/boloes/${id}/jogos`}>Abrir jogos</Link></article>
    </section>
  </main>;
}
