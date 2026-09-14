import { NextRequest, NextResponse } from "next/server";
import {
  caixaResultUrl,
  supportedLotteries,
  type SupportedLottery,
} from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CaixaPrize = {
  faixa?: number;
  descricaoFaixa?: string;
  numeroDeGanhadores?: number;
  valorPremio?: number;
};

type CaixaResult = {
  numero?: number;
  dataApuracao?: string;
  listaDezenas?: string[];
  listaDezenasSegundoSorteio?: string[] | null;
  trevosSorteados?: string[] | null;
  listaTrevos?: string[] | null;
  nomeTimeCoracaoMesSorte?: string | null;
  listaRateioPremio?: CaixaPrize[] | null;
};

const headers = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "User-Agent": "Mozilla/5.0 (compatible; BolaoAmigosBTP/1.0)",
};

const numbers = (values?: string[] | null) =>
  (values ?? []).map(Number).filter(Number.isFinite);

export async function GET(request: NextRequest) {
  const lottery = request.nextUrl.searchParams.get("lottery") as SupportedLottery | null;
  const contest = Number(request.nextUrl.searchParams.get("contest"));

  if (
    !lottery ||
    !supportedLotteries.includes(lottery) ||
    !Number.isInteger(contest) ||
    contest < 1
  ) {
    return NextResponse.json(
      { error: "Modalidade ou concurso inválido." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(caixaResultUrl(lottery, contest), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404) {
      return NextResponse.json(
        { available: false, lottery, contest },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!response.ok) throw new Error(`CAIXA HTTP ${response.status}`);

    const data = (await response.json()) as CaixaResult;
    if (Number(data.numero) !== contest || !data.listaDezenas?.length) {
      return NextResponse.json(
        { available: false, lottery, contest },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        available: true,
        lottery,
        contest,
        drawDate: data.dataApuracao ?? null,
        numbers: numbers(data.listaDezenas),
        secondDrawNumbers: numbers(data.listaDezenasSegundoSorteio),
        trevos: numbers(data.trevosSorteados ?? data.listaTrevos),
        special: data.nomeTimeCoracaoMesSorte ?? null,
        prizes: (data.listaRateioPremio ?? []).map((prize) => ({
          tier: Number(prize.faixa ?? 0),
          label: String(prize.descricaoFaixa ?? "").trim(),
          winners: Number(prize.numeroDeGanhadores ?? 0),
          value: Number(prize.valorPremio ?? 0),
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("personal-game-result:", error);
    return NextResponse.json(
      { error: "Resultado temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
