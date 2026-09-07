export const lotteryResultSources = {
  "mega-sena": { caixaSlug: "megasena" },
  lotofacil: { caixaSlug: "lotofacil" },
  quina: { caixaSlug: "quina" },
  "dupla-sena": { caixaSlug: "duplasena" },
  lotomania: { caixaSlug: "lotomania" },
  timemania: { caixaSlug: "timemania" },
  "dia-de-sorte": { caixaSlug: "diadesorte" },
  "super-sete": { caixaSlug: "supersete" },
  "mais-milionaria": { caixaSlug: "maismilionaria" },
} as const;

export type SupportedLottery = keyof typeof lotteryResultSources;

export const supportedLotteries = Object.keys(lotteryResultSources) as SupportedLottery[];

export function caixaResultUrl(lottery: SupportedLottery, contest?: number) {
  const base = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${lotteryResultSources[lottery].caixaSlug}`;
  return contest ? `${base}/${contest}` : base;
}
