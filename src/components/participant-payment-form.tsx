"use client";
import { useState } from "react";
import { confirmParticipantPaymentForm } from "@/app/actions/payments";
const money = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    c / 100,
  );
export function ParticipantPaymentForm({
  poolId,
  participantId,
  shares,
  remainingCents,
}: {
  poolId: string;
  participantId: string;
  shares: number;
  remainingCents: number;
}) {
  const [method, setMethod] = useState("pix");
  return (
    <form
      className="form participant-pay-form"
      action={confirmParticipantPaymentForm}
    >
      <input type="hidden" name="poolId" value={poolId} />
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="shares" value={shares} />
      <input type="hidden" name="remainingCents" value={remainingCents} />
      <select
        name="method"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      >
        <option value="pix">Pix</option>
        <option value="cash">Dinheiro</option>
        <option value="other">Outro</option>
      </select>
      {method === "cash" && (
        <div className="field">
          <label>Valor recebido agora</label>
          <input
            name="receivedAmount"
            inputMode="decimal"
            placeholder="R$ 0,00"
            required
            autoFocus
          />
          <span className="muted">Falta quitar {money(remainingCents)}</span>
        </div>
      )}
      <button className="button primary">
        {method === "cash" ? "Adicionar pagamento" : "Confirmar"}
      </button>
    </form>
  );
}
