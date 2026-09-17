import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PoolSwitcher } from "@/components/pool-switcher";

export const dynamic = "force-dynamic";

const H36 = 36 * 60 * 60 * 1000;
const SIX_MONTHS = 183 * 24 * 60 * 60 * 1000;

const labels: Record<string, string> = {
  "mega-sena": "Mega-Sena",
  lotofacil: "Lotofácil",
  quina: "Quina",
  "dupla-sena": "Dupla Sena",
  lotomania: "Lotomania",
  timemania: "Timemania",
  "dia-de-sorte": "Dia de Sorte",
  "super-sete": "Super Sete",
  "mais-milionaria": "+Milionária",
};

export default async function HistoricoBolao({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const query = await searchParams;
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) {
    return (
      <main className="shell">
        <section className="section">
          <h1>Histórico do Bolão</h1>
          <p>Entre como organizador para acessar este histórico.</p>
        </section>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: ownedPools } = await admin
    .from("pools")
    .select("id,title,lottery,contest_number")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  const pools = ownedPools ?? [];
  const pool = pools.find((item) => item.id === query.pool) ?? pools[0];
  if (!pool) {
    return (
      <main className="shell">
        <Link className="back" href="/menu">← Voltar ao Menu</Link>
        <section className="section"><h1>Histórico do Bolão</h1><p>Crie um bolão primeiro.</p></section>
      </main>
    );
  }

  const now = Date.now();
  const archivedBefore = new Date(now - H36).toISOString();
  const retentionSince = new Date(now - SIX_MONTHS).toISOString();
  const poolIds = pools.map((item) => item.id);

  // Limpeza de retenção: ao abrir o histórico, remove registros com mais de 6 meses
  // somente dos bolões pertencentes ao organizador autenticado.
  if (poolIds.length) {
    const { data: expiredReceipts } = await admin
      .from("game_receipts")
      .select("id,storage_path")
      .in("pool_id", poolIds)
      .lt("published_at", retentionSince);
    const paths = (expiredReceipts ?? []).map((item) => item.storage_path).filter(Boolean);
    if (paths.length) await admin.storage.from("game-receipts").remove(paths);
    await admin.from("game_receipts").delete().in("pool_id", poolIds).lt("published_at", retentionSince);
    await admin.from("manual_lottery_results").delete().in("pool_id", poolIds).lt("updated_at", retentionSince);
  }

  const { data: receipts } = await admin
    .from("game_receipts")
    .select("id,title,storage_path,published_at")
    .eq("pool_id", pool.id)
    .eq("status", "published")
    .lt("published_at", archivedBefore)
    .gte("published_at", retentionSince)
    .order("published_at", { ascending: false });

  const receiptRows = await Promise.all(
    (receipts ?? []).map(async (receipt) => {
      const { data } = await admin.storage
        .from("game-receipts")
        .createSignedUrl(receipt.storage_path, 900);
      return { ...receipt, url: data?.signedUrl ?? "" };
    }),
  );

  const { data: results } = await admin
    .from("manual_lottery_results")
    .select("id,lottery,contest_number,numbers,checked_games,total_cost_cents,received_prize_cents,updated_at")
    .eq("pool_id", pool.id)
    .lt("updated_at", archivedBefore)
    .gte("updated_at", retentionSince)
    .order("updated_at", { ascending: false });

  return (
    <main className="shell">
      <Link className="back" href="/menu">← Voltar ao Menu</Link>
      <section className="section">
        <p className="eyebrow">PAINEL DO ORGANIZADOR</p>
        <h1>Histórico do Bolão</h1>
        <p className="muted">
          Bilhetes e resultados saem da área do participante após 36 horas e ficam disponíveis aqui por até 6 meses.
        </p>
        <PoolSwitcher pools={pools} activeId={pool.id} basePath="/historico-bolao" />
      </section>

      <section className="section">
        <h2>Bilhetes arquivados</h2>
        <div className="list">
          {receiptRows.length ? receiptRows.map((receipt) => (
            <div className="card" key={receipt.id}>
              <strong>{receipt.title}</strong>
              <span className="muted">
                Publicado em {new Date(receipt.published_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </span>
              {receipt.url ? (
                <a className="button secondary" href={receipt.url} target="_blank" rel="noreferrer">ABRIR BILHETE</a>
              ) : (
                <span className="muted">Arquivo indisponível.</span>
              )}
            </div>
          )) : <p className="muted">Nenhum bilhete arquivado neste bolão.</p>}
        </div>
      </section>

      <section className="section">
        <h2>Resultados arquivados</h2>
        <div className="list">
          {(results ?? []).length ? (results ?? []).map((result: any) => {
            const games = Array.isArray(result.checked_games) ? result.checked_games : [];
            const numbers = Array.isArray(result.numbers) ? result.numbers : [];
            return (
              <div className="card" key={result.id}>
                <strong>{labels[result.lottery] ?? result.lottery} · Concurso {result.contest_number}</strong>
                <span>{numbers.map((n: number) => String(n).padStart(2, "0")).join(" · ")}</span>
                <span className="muted">{games.length} jogo(s) conferido(s)</span>
                <span className="muted">
                  Publicado em {new Date(result.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </div>
            );
          }) : <p className="muted">Nenhum resultado arquivado neste bolão.</p>}
        </div>
      </section>
    </main>
  );
}
