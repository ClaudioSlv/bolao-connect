const choose = (n: number, k: number) => {
  let result = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) result = result * (n - i + 1) / i;
  return Math.round(result);
};
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;

// Visit distinct combination ranks instead of retrying already-created games.
export function uniqueLotofacil(numbers: number[], pick: number, wanted: number) {
  if (!Number.isInteger(pick) || pick < 1 || pick > numbers.length) throw new Error("Quantidade de dezenas inválida.");
  const total = choose(numbers.length, pick);
  let rank = Math.floor(Math.random() * total);
  let stride = total > 1 ? 1 + Math.floor(Math.random() * (total - 1)) : 1;
  while (gcd(stride, total) !== 1) stride = stride % total + 1;
  let remaining = Math.min(wanted, total);
  return {
    total,
    next(): number[] | null {
      if (remaining-- <= 0) return null;
      let rest = rank;
      let start = 0;
      const selected: number[] = [];
      for (let slots = pick; slots > 0; slots--) {
        for (let index = start; index <= numbers.length - slots; index++) {
          const block = choose(numbers.length - index - 1, slots - 1);
          if (rest < block) { selected.push(numbers[index]); start = index + 1; break; }
          rest -= block;
        }
      }
      rank = (rank + stride) % total;
      return selected.sort((a, b) => a - b);
    },
  };
}
