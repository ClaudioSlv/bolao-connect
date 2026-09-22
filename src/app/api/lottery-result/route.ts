import { NextRequest, NextResponse } from "next/server";
import {
  fetchOfficialPersonalDraw,
  isSupportedLottery,
} from "@/lib/personal-game-prizes";
import type { SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_BASES = [
  "https://loteriascaixa-api.herokuapp.com/api",
  "https://loterias-gutotech.herokuapp.com/api",
  "https://loterias-caixa-gov.herokuapp.com/api",
];

const fallbackPaths: Record<SupportedLottery, string> = {
  "mega-sena": "megasena",
  lotofacil: "lotofacil",
  quina: "quina",
  "dupla-sena": "duplasena",
  lotomania: "lotomania",
  timemania: "timemania",
  "dia-de-sorte": "diadesorte",
  "super-sete": "supersete",
  "mais-milionaria": "maismilionaria",
};

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

type FallbackPayload = {
  numeroDoConcurso?: number;
  numero?: number;
  concurso?: number;
  dataApuracao?: string;
  data?: string;
  dezenas?: Array<string | number>;
  listaDezenas?: Array<string | number>;
  dezenasSegundoSorteio?: Array<string | number>;
  listaDezenasSegundoSorteio?: Array<string | number>;
  trevosSorteados?: Array<string | number>;
  listaTrevos?: Array<string | number>;
  trevos?: Array<string | number>;
};

const numbers = (values?: Array<string | number>) =>
  (values ?? []).map(Number).filter(Number.isFinite);

async function fetchFallback(
  lottery: SupportedLottery,
  contest: number,
  base: string,
) {
  const response = await fetch(
    `${base}/${fallbackPaths[lottery]}/${contest}`,
    {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; BolaoAmigosBTP/1.0)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`fonte alternativa HTTP ${response.status}`);

  const data = (await response.json()) as FallbackPayload;
  const returnedContest = Number(
    data.numeroDoConcurso ?? data.numero ?? data.concurso ?? 0,
  );
  const drawNumbers = numbers(data.dezenas ?? data.listaDezenas);

  if (returnedContest !== contest || drawNumbers.length === 0)
    throw new Error("resultado alternativo inválido");

  return {
    available: true,
    lottery,
    contest,
    drawDate: data.dataApuracao ?? data.data ?? null,
    numbers: drawNumbers,
    secondDrawNumbers: numbers(
      data.dezenasSegundoSorteio ?? data.listaDezenasSegundoSorteio,
    ),
    trevos: numbers(
      data.trevosSorteados ?? data.listaTrevos ?? data.trevos,
    ),
    special: null,
    prizes: [],
    source: "fallback",
  };
}

async function firstValidFallback(
  lottery: SupportedLottery,
  contest: number,
) {
  const attempts = await Promise.allSettled(
    FALLBACK_BASES.map((base) => fetchFallback(lottery, contest, base)),
  );
  const result = attempts.find(
    (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchFallback>>> =>
      attempt.status === "fulfilled",
  );
  return result?.value ?? null;
}

export async function GET(request: NextRequest) {
  const lottery = request.nextUrl.searchParams.get("lottery") ?? "";
  const contest = Number(request.nextUrl.searchParams.get("contest"));

  if (!isSupportedLottery(lottery)) {
    return NextResponse.json(
      { error: "Modalidade não reconhecida." },
      { status: 400, headers: noCacheHeaders },
    );
  }
  if (!Number.isInteger(contest) || contest <= 0) {
    return NextResponse.json(
      { error: "Informe um concurso válido." },
      { status: 400, headers: noCacheHeaders },
    );
  }

  try {
    const official = await fetchOfficialPersonalDraw(lottery, contest);
    if (official.available) {
      return NextResponse.json(
        { ...official, source: "caixa" },
        { headers: noCacheHeaders },
      );
    }
  } catch (error) {
    console.warn("lottery-result: CAIXA indisponível, tentando reserva", {
      lottery,
      contest,
      error,
    });
  }

  try {
    const fallback = await firstValidFallback(lottery, contest);
    if (fallback)
      return NextResponse.json(fallback, { headers: noCacheHeaders });
  } catch (error) {
    console.error("lottery-result: fontes alternativas indisponíveis", {
      lottery,
      contest,
      error,
    });
  }

  return NextResponse.json(
    { error: "Não foi possível consultar o resultado agora." },
    { status: 503, headers: noCacheHeaders },
  );
}
