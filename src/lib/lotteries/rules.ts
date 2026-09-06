import type { LotteryId } from "../domain";

export type SpecialField = "team" | "month" | "columns" | "trevos";

export interface PrizeRule {
  hits: number;
  label: string;
}

export interface LotteryRule {
  id: LotteryId;
  name: string;
  minNumbers: number;
  maxNumbers: number;
  numberMin: number;
  numberMax: number;
  drawsPerContest?: number;
  specialField?: SpecialField;
  prizeRules?: PrizeRule[];
}

export const LOTTERY_RULES: Record<LotteryId, LotteryRule> = {
  "mega-sena": { id: "mega-sena", name: "Mega-Sena", minNumbers: 6, maxNumbers: 20, numberMin: 1, numberMax: 60, prizeRules: [{ hits: 4, label: "Quadra" }, { hits: 5, label: "Quina" }, { hits: 6, label: "Sena" }] },
  lotofacil: { id: "lotofacil", name: "Lotofácil", minNumbers: 15, maxNumbers: 20, numberMin: 1, numberMax: 25 },
  quina: { id: "quina", name: "Quina", minNumbers: 5, maxNumbers: 15, numberMin: 1, numberMax: 80 },
  "dupla-sena": { id: "dupla-sena", name: "Dupla Sena", minNumbers: 6, maxNumbers: 15, numberMin: 1, numberMax: 50, drawsPerContest: 2 },
  lotomania: { id: "lotomania", name: "Lotomania", minNumbers: 50, maxNumbers: 50, numberMin: 0, numberMax: 99 },
  timemania: { id: "timemania", name: "Timemania", minNumbers: 10, maxNumbers: 10, numberMin: 1, numberMax: 80, specialField: "team" },
  "dia-de-sorte": { id: "dia-de-sorte", name: "Dia de Sorte", minNumbers: 7, maxNumbers: 15, numberMin: 1, numberMax: 31, specialField: "month" },
  "super-sete": { id: "super-sete", name: "Super Sete", minNumbers: 7, maxNumbers: 21, numberMin: 0, numberMax: 9, specialField: "columns" },
  "mais-milionaria": { id: "mais-milionaria", name: "+Milionária", minNumbers: 6, maxNumbers: 12, numberMin: 1, numberMax: 50, specialField: "trevos" }
};
