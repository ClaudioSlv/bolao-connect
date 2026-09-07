import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";

export default async function Conferencia() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let games: Array<{ id: string; numbers: number[] }> = [];

  if (auth.user) {
    const { data: pools } = await supabase.from("pools").select("id").eq("owner_id", auth.user.id);
    const poolIds = (pools ?? []).map((pool) => pool.id);
    if (poolIds.length) {
      const { data } = await supabase.from("games").select("id,numbers").in("pool_id", poolIds).order("created_at", { ascending: true });
      games = (data ?? []) as typeof games;
    }
  }

  return (
    <main className="shell">
      <Link className="back" href="/">← Voltar</Link>
      <section className="section">
        <h1>✅ Conferência dos Jogos</h1>
        <p className="muted">O resultado oficial será comparado com os jogos cadastrados.</p>
      </section>
      <section className="section"><div className="card"><strong>Resultado ainda não importado</strong><span>Quando houver resultado disponível, a conferência aparecerá aqui.</span></div></section>
      <section className="section">
        <h2>Jogos cadastrados</h2>
        <div className="list">
          {games.length === 0 ? <p className="muted">Nenhum jogo cadastrado para conferir.</p> : games.map((game, index) => (
            <div className="list-item" key={game.id}><div><strong>Jogo {String(index + 1).padStart(2, "0")}</strong><div className="muted">{game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")} · Aguardando resultado</div></div><span className="status">—</span></div>
          ))}
        </div>
        <p className="muted">Qualquer possível premiação deverá ser validada oficialmente antes de ser apresentada como prêmio confirmado.</p>
      </section>
      <AppNav />
    </main>
  );
}
