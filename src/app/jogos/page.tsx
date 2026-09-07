import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";
import { addGame } from "@/app/actions/games";

async function addGameFromForm(formData: FormData) {
  "use server";
  const poolId = String(formData.get("poolId") ?? "");
  const numbers = String(formData.get("numbers") ?? "").split(/[\s,;.-]+/).filter(Boolean).map(Number);
  const amountText = String(formData.get("betAmount") ?? "").trim().replace(",", ".");
  const betAmountCents = amountText ? Math.round(Number(amountText) * 100) : undefined;
  const receiptUrl = String(formData.get("receiptUrl") ?? "").trim();
  await addGame({ poolId, numbers, betAmountCents, receiptUrl });
}

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default async function Jogos() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let pools: Array<{ id: string; title: string }> = [];
  let games: Array<{ id: string; numbers: number[]; status: string | null; bet_amount_cents: number | null; receipt_url: string | null }> = [];

  if (auth.user) {
    const { data: ownedPools } = await supabase.from("pools").select("id,title").eq("owner_id", auth.user.id).order("created_at", { ascending: false });
    pools = ownedPools ?? [];
    if (pools.length) {
      const { data } = await supabase.from("games").select("id,numbers,status,bet_amount_cents,receipt_url").in("pool_id", pools.map((pool) => pool.id)).order("created_at", { ascending: false });
      games = (data ?? []) as typeof games;
    }
  }

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section"><h1>🎟️ Jogos</h1><p className="muted">Cadastre as dezenas, valor e comprovante dos jogos do seu bolão.</p>
      {!auth.user ? <p className="muted">Entre na sua conta para cadastrar e consultar jogos.</p> : pools.length === 0 ? <p className="muted">Crie um bolão antes de cadastrar jogos.</p> :
      <form className="form" action={addGameFromForm}>
        <div className="field"><label htmlFor="poolId">Bolão</label><select id="poolId" name="poolId" required>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.title}</option>)}</select></div>
        <div className="field"><label htmlFor="numbers">Dezenas</label><input id="numbers" name="numbers" required placeholder="05 12 18 27 44 58" /></div>
        <div className="field"><label htmlFor="betAmount">Valor da aposta (R$)</label><input id="betAmount" name="betAmount" inputMode="decimal" placeholder="0,00" /></div>
        <div className="field"><label htmlFor="receiptUrl">Link do comprovante</label><input id="receiptUrl" name="receiptUrl" type="url" placeholder="https://..." /></div>
        <button className="button primary" type="submit">+ Cadastrar jogo</button>
      </form>}
    </section>
    <section className="section list">{games.length === 0 ? <p className="muted">Nenhum jogo cadastrado ainda.</p> : games.map((game, index) => <div className="list-item" key={game.id}>
      <div><strong>Jogo {String(games.length - index).padStart(2, "0")}</strong><div className="muted">{game.numbers.map((n) => String(n).padStart(2, "0")).join(" · ")}</div>{game.bet_amount_cents ? <div className="muted">Valor: {money(game.bet_amount_cents)}</div> : null}{game.receipt_url ? <div><a className="back" href={game.receipt_url} target="_blank" rel="noreferrer">Ver comprovante</a></div> : null}</div>
      <span className="status">{game.status === "registered" ? "CADASTRADO" : (game.status ?? "CADASTRADO").toUpperCase()}</span>
    </div>)}</section>
    <AppNav />
  </main>;
}
