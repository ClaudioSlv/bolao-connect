export function maxInstallments(totalCents: number): number {
  return Math.max(2, Math.ceil(totalCents / 4_000));
}
