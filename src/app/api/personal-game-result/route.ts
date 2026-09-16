import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  fetchOfficialPersonalDraw,
  isSupportedLottery,
} from "@/lib/personal-game-prizes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function participantTokenFromReferer(request: NextRequest) {
  try {
    const referer = request.headers.get("referer");
    if (!referer) return "";
    const url = new URL(referer);
    const back = url.searchParams.get("voltar") ?? "";
    const match = back.match(/^\/p\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

async function manualDraw(request: NextRequest, lottery: string, contest: number) {
  try {
    const admin = createAdminClient();
    const explicitToken = request.nextUrl.searchParams.get("token") ?? "";
    const token = explicitToken || participantTokenFromReferer(request);
    let ownerId = "";

    if (token) {
      const { data: participant } = await admin
        .from("participants")
        .select("pool_id,status")
        .eq("access_token", token)
        .maybeSingle();
      if (participant && participant.status !== "cancelled") {
        const { data: pool } = await admin
          .from("pools")
          .select("owner_id")
          .eq("id", participant.pool_id)
          .maybeSingle();
        ownerId = String(pool?.owner_id ?? "");
      }
    } else {
      const client = await createClient();
      const { data: auth } = await client.auth.getUser();
      ownerId = String(auth.user?.id ?? "");
    }

    if (!ownerId) return null;

    const { data, error } = await admin
      .from("manual_lottery_results")
      .select("lottery,contest_number,numbers,second_draw_numbers,trevos,updated_at")
      .eq("owner_id", ownerId)
      .eq("lottery", lottery)
      .eq("contest_number", contest)
      .maybeSingle();

    if (error || !data) return null;

    return {
      available: true,
      source: "manual-organizer",
      lottery: data.lottery,
      contest: Number(data.contest_number),
      drawDate: null,
      numbers: Array.isArray(data.numbers) ? data.numbers.map(Number) : [],
      secondDrawNumbers: Array.isArray(data.second_draw_numbers)
        ? data.second_draw_numbers.map(Number)
        : [],
      trevos: Array.isArray(data.trevos) ? data.trevos.map(Number) : [],
      special: null,
      prizes: [],
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("manual-personal-game-result:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const lottery = request.nextUrl.searchParams.get("lottery") ?? "";
  const contest = Number(request.nextUrl.searchParams.get("contest"));
  if (!isSupportedLottery(lottery) || !Number.isInteger(contest) || contest < 1)
    return NextResponse.json(
      { error: "Modalidade ou concurso inválido." },
      { status: 400 },
    );

  const manual = await manualDraw(request, lottery, contest);
  if (manual)
    return NextResponse.json(manual, {
      headers: { "Cache-Control": "no-store" },
    });

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
