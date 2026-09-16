import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupportedLottery } from "@/lib/personal-game-prizes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validNumbers(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((number) => Number.isInteger(Number(number)))
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lottery = String(body.lottery ?? "");
    const contest = Number(body.contest);
    const numbers = body.numbers;
    const secondDrawNumbers = body.secondDrawNumbers ?? [];
    const trevos = body.trevos ?? [];

    if (
      !isSupportedLottery(lottery) ||
      !Number.isInteger(contest) ||
      contest < 1 ||
      !validNumbers(numbers) ||
      !validNumbers(secondDrawNumbers) ||
      !validNumbers(trevos)
    ) {
      return NextResponse.json({ error: "Resultado manual inválido." }, { status: 400 });
    }

    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      return NextResponse.json({ error: "Faça login como organizador." }, { status: 401 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("manual_lottery_results")
      .upsert(
        {
          owner_id: auth.user.id,
          lottery,
          contest_number: contest,
          numbers: numbers.map(Number),
          second_draw_numbers: secondDrawNumbers.map(Number),
          trevos: trevos.map(Number),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,lottery,contest_number" },
      )
      .select("id,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id, updatedAt: data.updated_at });
  } catch (error) {
    console.error("save-manual-lottery-result:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o resultado manual." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const lottery = request.nextUrl.searchParams.get("lottery") ?? "";
    const contest = Number(request.nextUrl.searchParams.get("contest"));
    const token = request.nextUrl.searchParams.get("token") ?? "";

    if (!isSupportedLottery(lottery) || !Number.isInteger(contest) || contest < 1)
      return NextResponse.json({ error: "Modalidade ou concurso inválido." }, { status: 400 });

    const admin = createAdminClient();
    let ownerId = "";

    if (token) {
      const { data: participant } = await admin
        .from("participants")
        .select("pool_id,status")
        .eq("access_token", token)
        .maybeSingle();
      if (!participant || participant.status === "cancelled")
        return NextResponse.json({ error: "Participante inválido." }, { status: 404 });

      const { data: pool } = await admin
        .from("pools")
        .select("owner_id")
        .eq("id", participant.pool_id)
        .maybeSingle();
      ownerId = String(pool?.owner_id ?? "");
    } else {
      const client = await createClient();
      const { data: auth } = await client.auth.getUser();
      ownerId = String(auth.user?.id ?? "");
    }

    if (!ownerId)
      return NextResponse.json({ available: false, lottery, contest });

    const { data, error } = await admin
      .from("manual_lottery_results")
      .select("lottery,contest_number,numbers,second_draw_numbers,trevos,updated_at")
      .eq("owner_id", ownerId)
      .eq("lottery", lottery)
      .eq("contest_number", contest)
      .maybeSingle();

    if (error) throw error;
    if (!data)
      return NextResponse.json({ available: false, lottery, contest });

    return NextResponse.json({
      available: true,
      source: "manual-organizer",
      lottery: data.lottery,
      contest: Number(data.contest_number),
      numbers: Array.isArray(data.numbers) ? data.numbers.map(Number) : [],
      secondDrawNumbers: Array.isArray(data.second_draw_numbers)
        ? data.second_draw_numbers.map(Number)
        : [],
      trevos: Array.isArray(data.trevos) ? data.trevos.map(Number) : [],
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error("get-manual-lottery-result:", error);
    return NextResponse.json(
      { error: "Não foi possível consultar o resultado manual." },
      { status: 500 },
    );
  }
}
