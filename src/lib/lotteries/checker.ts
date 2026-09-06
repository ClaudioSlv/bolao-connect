import type { LotteryId } from "../domain";
import { LOTTERY_RULES } from "./rules";

export interface DrawResult {
  lottery: LotteryId;
  contestNumber: number;
  drawnNumbers: number[];
  drawIndex?: number;
  specialValue?: string;
  publishedAt?: string;
}

export interface RegisteredGame {
  id: string;
  lottery: LotteryId;
  numbers: number[];
  specialValue?: string;
}

export type CheckStatus = "no_prize" | "possible_prize" | "manual_validation_required";

export interface CheckResult {
  gameId: string;
  contestNumber: number;
  hits: number;
  matchedNumbers: number[];
  prizeLabel?: string;
  status: CheckStatus;
}

export function checkSimpleGame(game: RegisteredGame, result: DrawResult): CheckResult {
  if (game.lottery !== result.lottery) throw new Error("Jogo e resultado pertencem a modalidades diferentes.");

  const matchedNumbers = game.numbers.filter((number) => result.drawnNumbers.includes(number));
  const rule = LOTTERY_RULES[game.lottery];
  const prizeRule = rule.prizeRules?.find((item) => item.hits === matchedNumbers.length);

  return {
    gameId: game.id,
    contestNumber: result.contestNumber,
    hits: matchedNumbers.length,
    matchedNumbers,
    prizeLabel: prizeRule?.label,
    status: prizeRule ? "possible_prize" : rule.prizeRules ? "no_prize" : "manual_validation_required"
  };
}

// Núcleo extensível. Modalidades com dois sorteios, campos especiais,
// combinações ou regras próprias terão adaptadores específicos antes da produção.
