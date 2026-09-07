import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";
import { addGame } from "@/app/actions/games";

async function addGameFromForm(formData: FormData) {
  "use server";
  const poolId = String(formData.get("poolId") ?? "");
  const numbers = String(formData.get("numbers") ?? "")
    .split(/[\s,;.-]+/)
    .filter(Boolean)
    .map(Number);
  await addGame({ poolId, numbers });
}

export default async function Jogos() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let pools: Array<{ id: string; title: string }> = [];
  let games: Array<{ id: string; numbers: number[]; status: string | null }> = [];

  if (auth.user) {
    const { data: ownedPools } = await supabase
      .from("pools")
      .select("id,title")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    pools = ownedPools ?? [];

    if (pools.length) {
      const { data } = await supabase
        .from("games")
        .select("id,numbers,status")
        .in("pool_id", pools.map((pool) => pool.id))
        .order("created_at", { ascending: false });
      games = (data ?? []) as typeof games;
    }
  }

  return (
    <main className="shell">
      <Link className="back" href="/">← Voltar</Link>
      <section className="section">
        <h1>🎟️ Jogos</h1>
        <p className="muted">Cadastre as dezenas dos jogos do seu bolão.</p>
        {!auth.user ? (
          <p className="muted">Entre na sua conta para cadastrar e consultar jogos.</p>
        ) : pools.length === 0 ? (
          <p className="muted">Crie um bolão antes de cadastrar jogos.</p>
        ) : (
          <form className="form" action={addGameFromForm}>
            <div className="field">
              <label htmlFor="poolId">Bolão</label>
              <select id="poolId" name="poolId" required>
                {pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="numbers">Dezenas</label>
              <input id="numbers" name="numbers" required placeholder="05 12 18 27 44 58" />
            </div>
            <button className="button primary" type="submit">+ Cadastrar jogo</button>
          </form>
        )}
      </section>
      <section className="section list">
        {games.length === 0 ? <p className="muted">Nenhum jogo cadastrado ainda.</p> : games.map((game, index) => (
          <div className="list-item" key={game.id}>
            <div><strong>Jogo {String(games.length - index).padStart(2, "0")}</strong><div className="muted">{game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}</div></div>
            <span className="status">{game.status === "registered" ? "CADASTRADO" : (game.status ?? "CADASTRADO").toUpperCase()}</span>
          </div>
        ))}
      </section>
      <AppNav />
    </main>
  );
}
