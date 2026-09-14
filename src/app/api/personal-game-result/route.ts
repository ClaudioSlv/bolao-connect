import { NextRequest, NextResponse } from "next/server";
import {
  fetchOfficialPersonalDraw,
  isSupportedLottery,
} from "@/lib/personal-game-prizes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const lottery = request.nextUrl.searchParams.get("lottery") ?? "";
  const contest = Number(request.nextUrl.searchParams.get("contest"));
  if (!isSupportedLottery(lottery) || !Number.isInteger(contest) || contest < 1)
    return NextResponse.json(
      { error: "Modalidade ou concurso inválido." },
      { status: 400 },
    );
  try {
    const draw = await fetchOfficialPersonalDraw(lottery, contest);
    return NextResponse.json(draw, {
      headers: {
        "Cache-Control": draw.available
          ? "public, s-maxage=120, stale-while-revalidate=300"
          : "no-store",
      },
    });
  } catch (error) {
    console.error("personal-game-result:", error);
    return NextResponse.json(
      { error: "Resultado temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
