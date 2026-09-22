import { NextRequest, NextResponse } from "next/server";
import {
  fetchOfficialPersonalDraw,
  isSupportedLottery,
} from "@/lib/personal-game-prizes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

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
    const result = await fetchOfficialPersonalDraw(lottery, contest);
    if (!result.available) {
      return NextResponse.json(
        { error: "Resultado ainda não disponível para este concurso." },
        { status: 404, headers: noCacheHeaders },
      );
    }
    return NextResponse.json(result, { headers: noCacheHeaders });
  } catch (error) {
    console.error("lottery-result: falha ao consultar resultado", {
      lottery,
      contest,
      error,
    });
    return NextResponse.json(
      { error: "Não foi possível consultar o resultado agora." },
      { status: 503, headers: noCacheHeaders },
    );
  }
}
