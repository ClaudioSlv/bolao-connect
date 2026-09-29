"use client";

import {useState} from "react";
import {resolutionAmounts} from "@/lib/partial-payment-resolution";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(cents/100);

export function PartialPaymentChoice({token, paidCents, existingChoice, retentionPercent}: {
  token: string; paidCents: number; existingChoice?: "refund" | "credit" | null; retentionPercent: number;
}) {
  const [choice, setChoice] = useState(existingChoice ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!existingChoice);
  const {retentionCents: retention} = resolutionAmounts(paidCents, "refund", retentionPercent);

  async function submit(selected: "refund" | "credit") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/partial-payment-choice", {
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({token, choice:selected}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar sua escolha.");
      setChoice(result.choice); setOpen(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tente novamente."); }
    finally { setBusy(false); }
  }

  return <>
    {choice && <p className="status" role="status">Sua escolha foi registrada: {choice === "refund" ? `solicitação de estorno de ${money(paidCents-retention)} (retenção administrativa de ${money(retention)})` : `crédito de ${money(paidCents)} para outro bolão`}. Aguarde a conferência financeira.</p>}
    {!choice && !open && <button className="button secondary" type="button" onClick={() => setOpen(true)}>ESCOLHER ESTORNO OU CRÉDITO</button>}
    {open && <div className="credit-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="partial-resolution-title">
      <div className="credit-choice-modal">
        <button className="credit-choice-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
        <h2 id="partial-resolution-title">Prazo encerrado: escolha o destino do valor pago</h2>
        <p>Você pagou <strong>{money(paidCents)}</strong>, mas a cota não foi quitada até o prazo. Após 24 horas de conciliação, a vaga será oferecida à próxima pessoa da fila.</p>
        <p>Você também pode falar com o organizador para combinar um Pix direto. Se ele confirmar a quitação da sua cota enquanto a vaga ainda estiver reservada, esta escolha de estorno ou crédito será encerrada.</p>
        <p className="status">{retentionPercent ? <>Se optar pelo estorno, haverá retenção administrativa de <strong>{retentionPercent}% do valor pago ({money(retention)})</strong>. Você receberá <strong>{money(paidCents-retention)}</strong>.</> : <>Se optar pelo estorno, você receberá <strong>100% do valor pago ({money(paidCents)})</strong>.</>}</p>
        <button className="button primary" type="button" disabled={busy} onClick={() => void submit("refund")}>SOLICITAR ESTORNO DE {money(paidCents-retention)}</button>
        <button className="button secondary" type="button" disabled={busy} onClick={() => void submit("credit")}>MANTER {money(paidCents)} COMO CRÉDITO</button>
        <p className="muted">Sua escolha financeira é independente da liberação da vaga. O pedido será registrado para execução financeira.</p>
        {error && <p className="status" role="alert">{error}</p>}
      </div>
    </div>}
  </>;
}
