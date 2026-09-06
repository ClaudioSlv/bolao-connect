import type { WalletSummary } from "./domain";

export type WalletEntryType = "payment_confirmed" | "payment_cancelled" | "adjustment";

export interface WalletEntry {
  type: WalletEntryType;
  amountCents: number;
  shares: number;
}

export function calculateWallet(targetCents: number, totalShares: number, entries: WalletEntry[]): WalletSummary {
  const totals = entries.reduce(
    (acc, entry) => {
      const direction = entry.type === "payment_cancelled" ? -1 : 1;
      acc.confirmedCents += direction * entry.amountCents;
      acc.confirmedShares += direction * entry.shares;
      return acc;
    },
    { confirmedCents: 0, confirmedShares: 0 }
  );

  return {
    targetCents,
    confirmedCents: Math.max(0, totals.confirmedCents),
    pendingCents: Math.max(0, targetCents - totals.confirmedCents),
    confirmedShares: Math.max(0, totals.confirmedShares),
    pendingShares: Math.max(0, totalShares - totals.confirmedShares)
  };
}
