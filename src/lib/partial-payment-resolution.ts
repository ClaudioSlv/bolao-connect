export function refundRetentionForVersion(version: number) {
  return version >= 7 ? 15 : version >= 6 ? 3 : 0;
}

export function resolutionAmounts(paidCents: number, choice: "refund" | "credit", retentionPercent = 15) {
  if (!Number.isSafeInteger(paidCents) || paidCents <= 0) throw new Error("Valor pago inválido.");
  const retentionCents = choice === "refund" ? Math.round(paidCents * retentionPercent / 100) : 0;
  return { retentionCents, amountCents: paidCents - retentionCents };
}
