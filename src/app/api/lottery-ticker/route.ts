import { NextResponse } from "next/server";
import { supportedLotteries, type SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CAIXA_HOME = "https://servicebus2.caixa.gov.br/portaldeloterias/api/home/ultimos-resultados";
const CAIXA_BASE = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

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

const caixaPaths: Record<SupportedLottery, string> = {
  "mega-sena": "megasena", lotofacil: "lotofacil", quina: "quina", "dupla-sena": "duplasena",
  lotomania: "lotomania", timemania: "timemania", "dia-de-sorte": "diadesorte",
  "super-sete": "supersete", "mais-milionaria": "maismilionaria",
};

type HomeResult = {
  numeroDoConcurso?: number;
  numero?: number;
  concurso?: number;
  dataApuracao?: string;
  data?: string;
  dezenas?: string[] | null;
  listaDezenas?: string[] | null;
  dezenasSegundoSorteio?: string[] | null;
  listaDezenasSegundoSorteio?: string[] | null;
  trevosSorteados?: string[] | null;
  listaTrevos?: string[] | null;
  timeDoCoracao?: string | null;
  nomeTimeCoracaoMesSorte?: string | null;
  mesDaSorte?: string | null;
  acumulado?: boolean;
  valorEstimadoProximoConcurso?: number;
};

const headers = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Referer: "https://loterias.caixa.gov.br/",
  Origin: "https://loterias.caixa.gov.br",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

function normalize(lottery: SupportedLottery, data: HomeResult) {
  let special: string | null = null;
  if (lottery === "timemania") special = (data.timeDoCoracao ?? data.nomeTimeCoracaoMesSorte ?? "").trim() || null;
  if (lottery === "dia-de-sorte") special = data.mesDaSorte ? `Mês da Sorte: ${data.mesDaSorte}` : (data.nomeTimeCoracaoMesSorte ? `Mês da Sorte: ${data.nomeTimeCoracaoMesSorte}` : null);
  return {
    lottery,
    label: labels[lottery],
    contest: Number(data.numeroDoConcurso ?? data.numero ?? data.concurso ?? 0),
    drawDate: data.dataApuracao ?? data.data ?? null,
    numbers: Array.isArray(data.dezenas) ? data.dezenas : (Array.isArray(data.listaDezenas) ? data.listaDezenas : []),
    secondDrawNumbers: Array.isArray(data.dezenasSegundoSorteio) ? data.dezenasSegundoSorteio : (Array.isArray(data.listaDezenasSegundoSorteio) ? data.listaDezenasSegundoSorteio : []),
    trevos: Array.isArray(data.trevosSorteados) ? data.trevosSorteados : (Array.isArray(data.listaTrevos) ? data.listaTrevos : []),
    special,
    accumulated: Boolean(data.acumulado),
    nextPrize: Number(data.valorEstimadoProximoConcurso ?? 0),
    prizes: [],
  };
}

async function fetchJson(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchIndividualResults() {
  const settled = await Promise.allSettled(supportedLotteries.map(async lottery => {
    const data = await fetchJson(`${CAIXA_BASE}/${caixaPaths[lottery]}`);
    const result = normalize(lottery, data as HomeResult);
    if (result.contest <= 0 || result.numbers.length === 0) throw new Error("resultado inválido");
    return result;
  }));
  const results = settled.flatMap(item => item.status === "fulfilled" ? [item.value] : []);
  const errors = settled.flatMap((item, index) => item.status === "rejected" ? [{ lottery: supportedLotteries[index], message: item.reason instanceof Error ? item.reason.message : "falha" }] : []);
  return { results, errors };
}

export async function GET() {
  const errors: { lottery: string; message: string }[] = [];
  try {
    const home = await fetchJson(CAIXA_HOME) as Record<string, HomeResult>;
    const results = supportedLotteries.flatMap(lottery => {
      const item = home[homeKeys[lottery]];
      if (!item) return [];
      const result = normalize(lottery, item);
      return result.contest > 0 && result.numbers.length > 0 ? [result] : [];
    });
    if (results.length) return NextResponse.json(
      { results, errors, source: "caixa-home", updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } },
    );
    errors.push({ lottery: "all", message: "Endpoint consolidado retornou vazio" });
  } catch (error) {
    errors.push({ lottery: "all", message: error instanceof Error ? error.message : "Falha no endpoint consolidado" });
  }

  const fallback = await fetchIndividualResults();
  errors.push(...fallback.errors);
  if (fallback.results.length) return NextResponse.json(
    { results: fallback.results, errors, source: "caixa-individual", updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } },
  );

  console.error("lottery-ticker: CAIXA indisponível", errors);
  return NextResponse.json(
    { results: [], errors, source: "caixa-unavailable", updatedAt: new Date().toISOString() },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
