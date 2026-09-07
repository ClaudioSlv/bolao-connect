import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { createPool } from "@/app/actions/pools";
import type { LotteryId } from "@/lib/domain";

async function createPoolFromForm(formData: FormData) {
  "use server";

  const title = String(formData.get("title") ?? "").trim();
  const lottery = String(formData.get("lottery") ?? "mega-sena") as LotteryId;
  const totalShares = Number(formData.get("totalShares"));
  const sharePrice = Number(String(formData.get("sharePrice") ?? "").replace(",", "."));
  const paymentDeadline = String(formData.get("paymentDeadline") ?? "");

  if (!title || !Number.isInteger(totalShares) || totalShares < 1 || !Number.isFinite(sharePrice) || sharePrice <= 0 || !paymentDeadline) {
    throw new Error("Preencha corretamente os dados do bolão.");
  }

  await createPool({
    title,
    lottery,
    totalShares,
    sharePriceCents: Math.round(sharePrice * 100),
    paymentDeadline: new Date(paymentDeadline).toISOString(),
  });

  redirect("/");
}

export default function CriarBolao() {
  return (
    <main className="shell">
      <Link className="back" href="/">← Voltar</Link>
      <section className="section">
        <h1>Criar novo bolão</h1>
        <p className="muted">Defina as informações principais do bolão.</p>
        <form className="form" action={createPoolFromForm}>
          <div className="field">
            <label htmlFor="title">Nome do bolão</label>
            <input id="title" name="title" required placeholder="Ex.: Mega da Virada 2026" />
          </div>
          <div className="field">
            <label htmlFor="lottery">Modalidade</label>
            <select id="lottery" name="lottery" defaultValue="mega-sena">
              <option value="mega-sena">Mega-Sena</option>
              <option value="lotofacil">Lotofácil</option>
              <option value="quina">Quina</option>
              <option value="dupla-sena">Dupla Sena</option>
              <option value="lotomania">Lotomania</option>
              <option value="timemania">Timemania</option>
              <option value="dia-de-sorte">Dia de Sorte</option>
              <option value="super-sete">Super Sete</option>
              <option value="mais-milionaria">+Milionária</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="totalShares">Total de cotas</label>
            <input id="totalShares" name="totalShares" type="number" min="1" required placeholder="50" />
          </div>
          <div className="field">
            <label htmlFor="sharePrice">Valor da cota</label>
            <input id="sharePrice" name="sharePrice" inputMode="decimal" required placeholder="131,04" />
          </div>
          <div className="field">
            <label htmlFor="paymentDeadline">Prazo de pagamento</label>
            <input id="paymentDeadline" name="paymentDeadline" type="datetime-local" required />
          </div>
          <button className="button primary" type="submit">Criar bolão</button>
        </form>
      </section>
      <AppNav />
    </main>
  );
}
