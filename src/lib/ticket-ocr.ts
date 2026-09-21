export type TicketLotteryRule = {
  min: number;
  max: number;
  allowRepeat?: boolean;
};

export function ticketNumbersFromLine(line: string, rule: TicketLotteryRule) {
  const cleaned = line
    .toUpperCase()
    .replace(/(?<=\d)[OQD](?=\d|\s|$)/g, "0")
    .replace(/(?<=\s)[OQD](?=\d)/g, "0");
  const matches = cleaned.match(/\d{1,3}/g) ?? [];
  const numbers = matches.map(Number).filter((number) => Number.isInteger(number) && number >= rule.min && number <= rule.max);
  if (rule.allowRepeat) return numbers;
  const unique: number[] = [];
  for (const number of numbers) if (!unique.includes(number)) unique.push(number);
  return unique;
}

function normalizeGame(numbers: number[], rule: TicketLotteryRule) {
  return rule.allowRepeat ? numbers : [...numbers].sort((a, b) => a - b);
}

function gameMarker(line: string) {
  return line.match(/^\s*([A-Z])(?:[\s.:)\]-]+)(?=\d)/)?.[1] ?? null;
}

export function extractTicketGames(text: string, rule: TicketLotteryRule, pick: number) {
  const games: number[][] = [];
  const seen = new Set<string>();
  const push = (numbers: number[]) => {
    if (numbers.length !== pick) return;
    const normalized = normalizeGame(numbers, rule);
    const key = normalized.join("-");
    if (!seen.has(key)) {
      seen.add(key);
      games.push(normalized);
    }
  };

  // Os bilhetes da CAIXA identificam as apostas como A, B, C... e podem
  // imprimir cada aposta em duas linhas. Preservar esses marcadores evita
  // que dezenas de apostas diferentes sejam misturadas pelo OCR.
  const markedText = text.replace(/\s+([A-Z])(?:[\s.:)\]-]+)(?=\d)/g, "\n$1 ");
  const rawLines = markedText.replace(/[|]/g, " ").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const markedGroups: number[][] = [];
  let markedBuffer: number[] | null = null;

  for (const line of rawLines) {
    const numbers = ticketNumbersFromLine(line, rule);
    if (gameMarker(line)) {
      if (markedBuffer?.length === pick) markedGroups.push(markedBuffer);
      markedBuffer = numbers;
      continue;
    }
    if (markedBuffer && markedBuffer.length < pick && numbers.length) {
      markedBuffer = rule.allowRepeat ? [...markedBuffer, ...numbers] : Array.from(new Set([...markedBuffer, ...numbers]));
      if (markedBuffer.length === pick) {
        markedGroups.push(markedBuffer);
        markedBuffer = null;
      }
    }
  }
  if (markedBuffer?.length === pick) markedGroups.push(markedBuffer);
  for (const group of markedGroups) push(group);
  // Se o OCR encontrou marcadores de apostas, nunca complete um jogo usando
  // números soltos do cabeçalho ou de outra aposta. É melhor pedir nova foto
  // do que apresentar 15 dezenas misturadas como se fossem válidas.
  if (markedGroups.length) return games;

  const candidates = rawLines.map((line) => ticketNumbersFromLine(line, rule)).filter((numbers) => numbers.length >= 3);
  for (const numbers of candidates) {
    if (numbers.length === pick) push(numbers);
    else if (numbers.length > pick && numbers.length % pick === 0) {
      for (let index = 0; index < numbers.length; index += pick) push(numbers.slice(index, index + pick));
    }
  }

  let buffer: number[] = [];
  for (const numbers of candidates) {
    if (numbers.length >= pick) { buffer = []; continue; }
    const merged = rule.allowRepeat ? [...buffer, ...numbers] : Array.from(new Set([...buffer, ...numbers]));
    if (merged.length === pick) { push(merged); buffer = []; continue; }
    if (merged.length < pick) { buffer = merged; continue; }
    buffer = [...numbers];
  }

  if (!games.length) {
    const allCandidates = candidates.flat();
    const all = rule.allowRepeat ? allCandidates : Array.from(new Set(allCandidates));
    for (let index = 0; index + pick <= all.length; index += pick) push(all.slice(index, index + pick));
  }
  return games;
}
