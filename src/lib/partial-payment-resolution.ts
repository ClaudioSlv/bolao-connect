export function resolutionAmounts(paidCents: number, choice: "refund" | "credit") {
  if (!Number.isSafeInteger(paidCents) || paidCents <= 0) throw new Error("Valor pago inválido.");
  const retentionCents = choice === "refund" ? Math.round(paidCents * 3 / 100) : 0;
  return { retentionCents, amountCents: paidCents - retentionCents };
}
