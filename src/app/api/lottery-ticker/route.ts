import { NextResponse } from "next/server";
import { caixaResultUrl, supportedLotteries, type SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";

const labels: Record<SupportedLottery, string> = {
  "mega-sena": "Mega-Sena",
  lotofacil: "Lotofácil",
  quina: "Quina",
  "dupla-sena": "Dupla Sena",
  lotomania: "Lotomania",
  timemania: "Timemania",
  "dia-de-sorte": "Dia de Sorte",
  "super-sete": "Super Sete",
  "mais-milionaria": "+Milionária",
};

type CaixaRateio = {
  descricaoFaixa?: string;
  numeroDeGanhadores?: number;
};

type CaixaLatest = {
  numero?: number;
  dataApuracao?: string;
  listaRateioPremio?: CaixaRateio[];
};

async function getLatest(lottery: SupportedLottery) {
  const response = await fetch(caixaResultUrl(lottery), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`CAIXA ${lottery}: HTTP ${response.status}`);
  const data = (await response.json()) as CaixaLatest;

  return {
    lottery,
    label: labels[lottery],
    contest: Number(data.numero ?? 0),
    drawDate: data.dataApuracao ?? null,
    prizes: (data.listaRateioPremio ?? []).map((row) => ({
      label: row.descricaoFaixa ?? "Faixa",
      winners: Number(row.numeroDeGanhadores ?? 0),
    })),
  };
}

export async function GET() {
  const settled = await Promise.allSettled(supportedLotteries.map(getLatest));
  const results = settled
    .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof getLatest>>> => item.status === "fulfilled")
    .map((item) => item.value)
    .filter((item) => item.contest > 0);

  return NextResponse.json(
    { results, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300" } },
  );
}
