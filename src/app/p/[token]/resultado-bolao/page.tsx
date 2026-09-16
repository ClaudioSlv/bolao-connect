import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CheckedGame = {
  id?: string;
  savedLabel?: string;
  gameIndex?: number;
  numbers?: number[];
  hits?: number;
  matched?: number[];
  trevoHits?: number;
};

type ManualResult = {
  id: string;
  lottery: string;
  contest_number: number;
  numbers: number[];
  checked_games: CheckedGame[];
  total_cost_cents: number;
  received_prize_cents: number | null;
  updated_at: string;
};

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

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

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: participant } = await admin
    .from("participants")
    .select("id,pool_id,name,status")
    .eq("access_token", token)
    .maybeSingle();

  if (!participant || participant.status === "cancelled") {
    return (
      <main className="shell">
        <section className="section"><h1>Link inválido</h1></section>
      </main>
    );
  }

  let results: ManualResult[] = [];
  try {
    const { data } = await admin
      .from("manual_lottery_results")
      .select("id,lottery,contest_number,numbers,checked_games,total_cost_cents,received_prize_cents,updated_at")
      .eq("pool_id", participant.pool_id)
      .order("contest_number", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(10);
    results = (data ?? []) as ManualResult[];
  } catch {
    results = [];
  }

  return (
    <main className="shell">
      <Link className="back" href={`/p/${token}`}>← Voltar</Link>

      <section className="section">
        <p className="eyebrow">RESULTADO DO BOLÃO</p>
        <h1>Conferência publicada</h1>
        <p className="muted">
          Aqui aparecem os resultados que o organizador conferiu e salvou para este bolão.
        </p>
      </section>

      {!results.length ? (
        <section className="section">
          <div className="card">
            <strong>Nenhum resultado manual publicado ainda.</strong>
            <span className="muted">Quando o organizador salvar uma conferência, ela ficará disponível aqui.</span>
          </div>
        </section>
      ) : (
        results.map((result) => {
          const games = Array.isArray(result.checked_games) ? result.checked_games : [];
          const maxHits = Math.max(0, ...games.map((game) => Number(game.hits || 0)));
          const totalCost = Number(result.total_cost_cents || 0);
          const received = result.received_prize_cents == null ? null : Number(result.received_prize_cents);
          const balance = received == null ? null : received - totalCost;

          return (
            <section className="section" key={result.id}>
              <p className="eyebrow">CONCURSO {result.contest_number}</p>
              <h2>{labels[result.lottery] ?? result.lottery}</h2>

              <div className="card">
                <strong>Resultado informado</strong>
                <div className="muted" style={{ marginTop: 8 }}>
                  {(result.numbers ?? []).map((number) => String(number).padStart(2, "0")).join(" · ")}
                </div>
              </div>

              <div className="performance-totals" style={{ marginTop: 16 }}>
                <div><span>Jogos conferidos</span><strong>{games.length}</strong></div>
                <div><span>Maior acerto</span><strong>{maxHits}</strong></div>
                <div><span>Total apostado</span><strong>{money(totalCost)}</strong></div>
              </div>

              {balance != null && received != null && (
                <div className="performance-totals" style={{ marginTop: 12 }}>
                  <div><span>Total recebido</span><strong>{money(received)}</strong></div>
                  <div>
                    <span>{balance >= 0 ? "Lucro" : "Prejuízo"}</span>
                    <strong className={balance >= 0 ? "performance-positive" : "performance-negative"}>
                      {money(Math.abs(balance))}
                    </strong>
                  </div>
                </div>
              )}

              <div className="list" style={{ marginTop: 16 }}>
                {games.map((game, index) => {
                  const matched = new Set((game.matched ?? []).map(Number));
                  const numbers = Array.isArray(game.numbers) ? game.numbers : [];
                  const hits = Number(game.hits || 0);
                  return (
                    <div className="list-item" key={game.id ?? `${result.id}-${index}`}>
                      <div>
                        <strong>{game.savedLabel ?? labels[result.lottery] ?? result.lottery} · Jogo {game.gameIndex ?? index + 1}</strong>
                        <div className="muted">
                          {numbers.map((number, numberIndex) => (
                            <b
                              key={numberIndex}
                              style={{
                                color: matched.has(Number(number)) ? "#55f27a" : "inherit",
                                textShadow: matched.has(Number(number)) ? "0 0 8px rgba(85,242,122,.6)" : "none",
                              }}
                            >
                              {String(number).padStart(2, "0")}{numberIndex < numbers.length - 1 ? " · " : ""}
                            </b>
                          ))}
                        </div>
                      </div>
                      <span className="status">{hits} ACERTO{hits === 1 ? "" : "S"}</span>
                    </div>
                  );
                })}
              </div>

              <p className="muted" style={{ marginTop: 12 }}>
                Atualizado em {new Date(result.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
              </p>
            </section>
          );
        })
      )}
    </main>
  );
}
