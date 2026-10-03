export function savedGameContest(input: { requested: unknown; latest: unknown; lottery: string; poolLottery?: string | null; poolContest?: unknown }): number | null {
  const valid = (value: unknown) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; };
  return valid(input.requested) || (valid(input.latest) ? Number(input.latest) + 1 : null)
    || (input.poolLottery === input.lottery ? valid(input.poolContest) : null);
}
