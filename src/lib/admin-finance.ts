export function parseMoneyToCents(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) ? cents : -1;
}

export function splitPrize<T extends { id: string; shares: number }>(
  amount: number,
  participants: T[],
) {
  const totalShares = participants.reduce(
    (sum, participant) => sum + Number(participant.shares),
    0,
  );
  if (!Number.isInteger(amount) || amount <= 0 || totalShares <= 0) return [];
  let used = 0;
  return participants.map((participant, index) => {
    const value =
      index === participants.length - 1
        ? amount - used
        : Math.floor((amount * Number(participant.shares)) / totalShares);
    used += value;
    return { participant, amountCents: value };
  });
}

export function paymentPosition(totalCents: number, receivedCents: number) {
  const received = Math.max(0, receivedCents),
    due = Math.max(0, totalCents - received);
  return {
    received,
    due,
    status: due === 0 ? "confirmed" : received > 0 ? "partial" : "pending",
  } as const;
}
