"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LOTTERY_RULES } from "@/lib/lotteries/rules";
import { createPool } from "@/lib/data/pools";

export default function NovoBolaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await createPool({
      title: String(form.get("title")),
      lottery: String(form.get("lottery")) as keyof typeof LOTTERY_RULES,
      sharePriceCents: Math.round(Number(form.get("sharePrice")) * 100),
      totalShares: Number(form.get("totalShares")),
      paymentDeadline: new Date(String(form.get("paymentDeadline"))).toISOString(),
      drawAt: form.get("drawAt") ? new Date(String(form.get("drawAt"))).toISOString() : undefined,
    });
    setLoading(false);
    if (!result.ok) return setError(result.error);
    router.push(`/boloes/${result.pool.id}`);
  }

  return (
    <main className="screen narrow">
      <section className="hero"><span className="eyebrow">Novo bolão</span><h1>Criar Bolão</h1><p>Defina as informações principais. Você poderá incluir participantes e jogos depois.</p></section>
      <form className="card stack" onSubmit={submit}>
        <label>Nome do bolão<input name="title" placeholder="Ex.: Mega da Virada 2026" required /></label>
        <label>Modalidade<select name="lottery" required>{Object.entries(LOTTERY_RULES).map(([id, rule]) => <option key={id} value={id}>{rule.name}</option>)}</select></label>
        <label>Quantidade de cotas<input name="totalShares" type="number" min="1" required /></label>
        <label>Valor da cota (R$)<input name="sharePrice" type="number" min="0.01" step="0.01" required /></label>
        <label>Prazo de pagamento<input name="paymentDeadline" type="datetime-local" required /></label>
        <label>Data do sorteio<input name="drawAt" type="datetime-local" /></label>
        {error && <p className="notice">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? "Criando..." : "Criar bolão"}</button>
      </form>
    </main>
  );
}
