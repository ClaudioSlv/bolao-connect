import { NextResponse } from "next/server";
import { supportedLotteries, type SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CAIXA_HOME = "https://servicebus2.caixa.gov.br/portaldeloterias/api/home/ultimos-resultados";
const CAIXA_BASE = "https://servicebus2.caixa.gov.br/portaldeloterias/api";
const FALLBACK_BASE = "https://loteriascaixa-api.herokuapp.com/api";

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

const fallbackPaths: Record<SupportedLottery, string> = {
  "mega-sena": "megasena", lotofacil: "lotofacil", quina: "quina", "dupla-sena": "duplasena",
  lotomania: "lotomania", timemania: "timemania", "dia-de-sorte": "diadesorte",
  "super-sete": "supersete", "mais-milionaria": "maismilionaria",
};

type HomeResult = {
  numeroDoConcurso?: number; numero?: number; concurso?: number;
  dataApuracao?: string; data?: string;
  dezenas?: string[] | null; listaDezenas?: string[] | null;
  dezenasSegundoSorteio?: string[] | null; listaDezenasSegundoSorteio?: string[] | null;
  trevosSorteados?: string[] | null; listaTrevos?: string[] | null; trevos?: string[] | null;
  timeDoCoracao?: string | null; timeCoracao?: string | null; nomeTimeCoracaoMesSorte?: string | null;
  mesDaSorte?: string | null; mesSorte?: string | null;
  acumulado?: boolean; acumulou?: boolean;
  valorEstimadoProximoConcurso?: number;
};

const headers = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (compatible; BolaoAmigosBTP/1.0)",
};

function normalize(lottery: SupportedLottery, data: HomeResult) {
  let special: string | null = null;
  if (lottery === "timemania") special = (data.timeDoCoracao ?? data.timeCoracao ?? data.nomeTimeCoracaoMesSorte ?? "").trim() || null;
  if (lottery === "dia-de-sorte") {
    const month = data.mesDaSorte ?? data.mesSorte ?? data.nomeTimeCoracaoMesSorte;
    special = month ? `Mês da Sorte: ${month}` : null;
  }
  return {
    lottery,
    label: labels[lottery],
    contest: Number(data.numeroDoConcurso ?? data.numero ?? data.concurso ?? 0),
    drawDate: data.dataApuracao ?? data.data ?? null,
    numbers: Array.isArray(data.dezenas) ? data.dezenas : (Array.isArray(data.listaDezenas) ? data.listaDezenas : []),
    secondDrawNumbers: Array.isArray(data.dezenasSegundoSorteio) ? data.dezenasSegundoSorteio : (Array.isArray(data.listaDezenasSegundoSorteio) ? data.listaDezenasSegundoSorteio : []),
    trevos: Array.isArray(data.trevosSorteados) ? data.trevosSorteados : (Array.isArray(data.listaTrevos) ? data.listaTrevos : (Array.isArray(data.trevos) ? data.trevos : [])),
    special,
    accumulated: Boolean(data.acumulado ?? data.acumulou),
    nextPrize: Number(data.valorEstimadoProximoConcurso ?? 0),
    prizes: [],
  };
}

async function fetchJson(url: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

async function fetchAll(base: string, paths: Record<SupportedLottery, string>, suffix = "") {
  const settled = await Promise.allSettled(supportedLotteries.map(async lottery => {
    const data = await fetchJson(`${base}/${paths[lottery]}${suffix}`);
    const result = normalize(lottery, data as HomeResult);
    if (result.contest <= 0 || result.numbers.length === 0) throw new Error("resultado inválido");
    return result;
  }));
  return {
    results: settled.flatMap(item => item.status === "fulfilled" ? [item.value] : []),
    errors: settled.flatMap((item, index) => item.status === "rejected" ? [{ lottery: supportedLotteries[index], message: item.reason instanceof Error ? item.reason.message : "falha" }] : []),
  };
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
    if (results.length) return NextResponse.json({ results, errors, source: "caixa-home", updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (error) { errors.push({ lottery: "all", message: error instanceof Error ? error.message : "Falha CAIXA" }); }

  const caixa = await fetchAll(CAIXA_BASE, caixaPaths);
  errors.push(...caixa.errors);
  if (caixa.results.length) return NextResponse.json({ results: caixa.results, errors, source: "caixa-individual", updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });

  const backup = await fetchAll(FALLBACK_BASE, fallbackPaths, "/latest");
  errors.push(...backup.errors);
  if (backup.results.length) return NextResponse.json({ results: backup.results, errors, source: "backup", updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });

  console.error("lottery-ticker: fontes indisponíveis", errors);
  return NextResponse.json({ results: [], errors, source: "unavailable", updatedAt: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
