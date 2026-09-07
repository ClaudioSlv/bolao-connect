import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";

type Game = { id: string; lottery: string; contest_number: number | null; numbers: number[] };
type Result = { id: string; lottery: string; contest_number: number; draw_index: number; numbers: number[]; source: string | null; published_at: string | null };

export const dynamic = "force-dynamic";

export default async function Conferencia() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let games: Game[] = [];
  let results: Result[] = [];

  if (auth.user) {
    const { data: pools } = await supabase.from("pools").select("id").eq("owner_id", auth.user.id);
    const poolIds = (pools ?? []).map((pool) => pool.id);
    if (poolIds.length) {
      const { data } = await supabase.from("games").select("id,lottery,contest_number,numbers").in("pool_id", poolIds).order("created_at", { ascending: true });
      games = (data ?? []) as Game[];

      const lotteries = [...new Set(games.map((game) => game.lottery))];
      if (lotteries.length) {
        const { data: resultData } = await supabase.from("lottery_results").select("id,lottery,contest_number,draw_index,numbers,source,published_at").in("lottery", lotteries).order("contest_number", { ascending: false });
        results = (resultData ?? []) as Result[];
      }
    }
  }

  const resultFor = (game: Game) => results.find((result) => result.lottery === game.lottery && (game.contest_number == null || result.contest_number === game.contest_number));
  const checkedCount = games.filter((game) => Boolean(resultFor(game))).length;

  return (
    <main className="shell">
      <Link className="back" href="/">← Voltar</Link>
      <section className="section">
        <h1>✅ Conferência dos Jogos</h1>
        <p className="muted">Compara as dezenas cadastradas com resultados registrados no Bolão Connect.</p>
      </section>
      <section className="section">
        <div className="card">
          <strong>{checkedCount ? `${checkedCount} jogo(s) com resultado disponível` : "Resultado ainda não disponível"}</strong>
          <span>{checkedCount ? "Confira abaixo os acertos de cada jogo." : "Assim que o resultado for registrado, a conferência aparecerá aqui."}</span>
        </div>
      </section>
      <section className="section">
        <h2>Jogos cadastrados</h2>
        <div className="list">
          {games.length === 0 ? <p className="muted">Nenhum jogo cadastrado para conferir.</p> : games.map((game, index) => {
            const result = resultFor(game);
            const resultNumbers = result?.numbers?.map(Number) ?? [];
            const matched = game.numbers.map(Number).filter((number) => resultNumbers.includes(number));
            return (
              <div className="list-item" key={game.id}>
                <div>
                  <strong>Jogo {String(index + 1).padStart(2, "0")}</strong>
                  <div className="muted">{game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}</div>
                  {result ? <div className="muted">Concurso {result.contest_number}{result.draw_index > 1 ? ` · sorteio ${result.draw_index}` : ""} · Acertos: {matched.length}{matched.length ? ` (${matched.map((n) => String(n).padStart(2, "0")).join(", ")})` : ""}</div> : <div className="muted">Aguardando resultado do concurso.</div>}
                </div>
                <span className="status">{result ? `${matched.length} ACERTO${matched.length === 1 ? "" : "S"}` : "—"}</span>
              </div>
            );
          })}
        </div>
        <p className="muted">A conferência é informativa. Qualquer possível premiação deve ser validada no resultado oficial antes de ser apresentada como prêmio confirmado.</p>
      </section>
      <AppNav />
    </main>
  );
}
