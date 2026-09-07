import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  let pool: { id: string; title: string; total_shares: number; share_price_cents: number } | null = null;
  let paidShares = 0;
  let pendingShares = 0;

  if (auth.user) {
    const { data } = await supabase
      .from("pools")
      .select("id,title,total_shares,share_price_cents")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    pool = data;

    if (pool) {
      const { data: participants } = await supabase
        .from("participants")
        .select("shares,payment_status")
        .eq("pool_id", pool.id);
      for (const participant of participants ?? []) {
        const shares = Number(participant.shares) || 0;
        if (participant.payment_status === "paid") paidShares += shares;
        else pendingShares += shares;
      }
    }
  }

  const collectedCents = pool ? paidShares * pool.share_price_cents : 0;
  const totalCents = pool ? pool.total_shares * pool.share_price_cents : 0;
  const progress = totalCents > 0 ? Math.min(100, Math.round((collectedCents / totalCents) * 100)) : 0;

  return (
    <main className="shell">
      <div className="brand"><strong>🍀 Bolão Connect</strong><span className="badge">Online</span></div>
      <section className="hero">
        <h1>Seu bolão organizado do começo ao resultado.</h1>
        <p className="muted">Crie grupos, distribua cotas, acompanhe pagamentos, publique jogos e deixe todos os participantes acompanharem a arrecadação.</p>
        <div className="actions">
          <Link className="button primary" href="/criar-bolao">+ Criar bolão</Link>
          <Link className="button secondary" href="/participantes">Participantes</Link>
        </div>
      </section>
      <section className="section">
        <h2>Gerenciar bolão</h2>
        <div className="grid">
          <Link className="card" href="/carteira"><strong>💰 Carteira</strong><span>Arrecadação transparente</span></Link>
          <Link className="card" href="/jogos"><strong>🎟️ Jogos</strong><span>Apostas e comprovantes</span></Link>
          <Link className="card" href="/conferencia"><strong>✅ Conferência</strong><span>Resultados e acertos</span></Link>
          <Link className="card" href="/participantes"><strong>👥 Participantes</strong><span>Cotas e pagamentos</span></Link>
        </div>
      </section>
      <section className="section">
        <h2>{pool ? pool.title : "Resumo"}</h2>
        {pool ? (
          <div className="wallet">
            <div className="wallet-row"><strong>Arrecadado</strong><strong>{money(collectedCents)}</strong></div>
            <div className="progress"><div style={{ width: `${progress}%` }} /></div>
            <div className="wallet-row"><span>{paidShares} cotas pagas</span><span>{pendingShares} pendentes</span></div>
            <small>Meta: {money(totalCents)} · {progress}% arrecadado</small>
          </div>
        ) : (
          <p className="muted">{auth.user ? "Você ainda não criou um bolão." : "Entre na sua conta para visualizar os dados do seu bolão."}</p>
        )}
      </section>
      <AppNav />
    </main>
  );
}
