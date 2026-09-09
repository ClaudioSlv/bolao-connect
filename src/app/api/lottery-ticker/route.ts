import { NextResponse } from "next/server";
import { caixaResultUrl, supportedLotteries, type SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const labels: Record<SupportedLottery, string> = {
  "mega-sena": "Mega-Sena", lotofacil: "Lotofácil", quina: "Quina", "dupla-sena": "Dupla Sena",
  lotomania: "Lotomania", timemania: "Timemania", "dia-de-sorte": "Dia de Sorte",
  "super-sete": "Super Sete", "mais-milionaria": "+Milionária",
};

type CaixaRateio = { descricaoFaixa?: string; numeroDeGanhadores?: number };
type CaixaLatest = {
  numero?: number; dataApuracao?: string; listaDezenas?: string[]; listaDezenasSegundoSorteio?: string[];
  listaTrevos?: string[]; nomeTimeCoracaoMesSorte?: string; acumulado?: boolean;
  valorEstimadoProximoConcurso?: number; listaRateioPremio?: CaixaRateio[];
};

async function getLatest(lottery: SupportedLottery) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(caixaResultUrl(lottery), {
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent": "Mozilla/5.0 (compatible; BolaoAmigosBTP/1.0)",
        referer: "https://loterias.caixa.gov.br/",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as CaixaLatest;
    const special = (data.nomeTimeCoracaoMesSorte ?? "").replace(/\0/g, "").trim() || null;
    return {
      lottery, label: labels[lottery], contest: Number(data.numero ?? 0), drawDate: data.dataApuracao ?? null,
      numbers: data.listaDezenas ?? [], secondDrawNumbers: data.listaDezenasSegundoSorteio ?? [], trevos: data.listaTrevos ?? [],
      special, accumulated: Boolean(data.acumulado), nextPrize: Number(data.valorEstimadoProximoConcurso ?? 0),
      prizes: (data.listaRateioPremio ?? []).map(row => ({label: row.descricaoFaixa ?? "Faixa", winners: Number(row.numeroDeGanhadores ?? 0)})),
    };
  } finally { clearTimeout(timeout); }
}

export async function GET() {
  const settled = await Promise.allSettled(supportedLotteries.map(getLatest));
  const results = settled.flatMap(item => item.status === "fulfilled" && item.value.contest > 0 ? [item.value] : []);
  const errors = settled.flatMap((item, index) => item.status === "rejected" ? [{lottery: supportedLotteries[index], message: item.reason instanceof Error ? item.reason.message : "Falha ao consultar CAIXA"}] : []);
  return NextResponse.json(
    { results, errors, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300" } }
  );
}
