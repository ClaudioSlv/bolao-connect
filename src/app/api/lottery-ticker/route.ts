import { NextResponse } from "next/server";
import { supportedLotteries, type SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CAIXA_HOME = "https://servicebus2.caixa.gov.br/portaldeloterias/api/home/ultimos-resultados";

const labels: Record<SupportedLottery, string> = {
  "mega-sena": "Mega-Sena", lotofacil: "Lotofácil", quina: "Quina", "dupla-sena": "Dupla Sena",
  lotomania: "Lotomania", timemania: "Timemania", "dia-de-sorte": "Dia de Sorte",
  "super-sete": "Super Sete", "mais-milionaria": "+Milionária",
};

const homeKeys: Record<SupportedLottery, string> = {
  "mega-sena": "megasena", lotofacil: "lotofacil", quina: "quina", "dupla-sena": "duplasena",
  lotomania: "lotomania", timemania: "timemania", "dia-de-sorte": "diaDeSorte",
  "super-sete": "superSete", "mais-milionaria": "maisMilionaria",
};

type HomeResult = {
  numeroDoConcurso?: number;
  dataApuracao?: string;
  dezenas?: string[] | null;
  dezenasSegundoSorteio?: string[] | null;
  trevosSorteados?: string[] | null;
  timeDoCoracao?: string | null;
  mesDaSorte?: string | null;
  acumulado?: boolean;
  valorEstimadoProximoConcurso?: number;
};

function normalize(lottery: SupportedLottery, data: HomeResult) {
  let special: string | null = null;
  if (lottery === "timemania") special = (data.timeDoCoracao ?? "").trim() || null;
  if (lottery === "dia-de-sorte") special = data.mesDaSorte ? `Mês da Sorte: ${data.mesDaSorte}` : null;
  return {
    lottery,
    label: labels[lottery],
    contest: Number(data.numeroDoConcurso ?? 0),
    drawDate: data.dataApuracao ?? null,
    numbers: Array.isArray(data.dezenas) ? data.dezenas : [],
    secondDrawNumbers: Array.isArray(data.dezenasSegundoSorteio) ? data.dezenasSegundoSorteio : [],
    trevos: Array.isArray(data.trevosSorteados) ? data.trevosSorteados : [],
    special,
    accumulated: Boolean(data.acumulado),
    nextPrize: Number(data.valorEstimadoProximoConcurso ?? 0),
    prizes: [],
  };
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(CAIXA_HOME, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; BolaoAmigosBTP/1.0)",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`CAIXA HTTP ${response.status}`);
    const home = (await response.json()) as Record<string, HomeResult>;
    const results = supportedLotteries.flatMap((lottery) => {
      const item = home[homeKeys[lottery]];
      if (!item) return [];
      const result = normalize(lottery, item);
      return result.contest > 0 ? [result] : [];
    });
    return NextResponse.json(
      { results, errors: [], source: "caixa-home", updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      { results: [], errors: [{ lottery: "all", message: error instanceof Error ? error.message : "Falha ao consultar CAIXA" }], source: "caixa-home", updatedAt: new Date().toISOString() },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
