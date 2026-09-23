import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupportedLottery } from "@/lib/personal-game-prizes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validNumbers(value: unknown) {
  return Array.isArray(value) && value.every((number) => Number.isInteger(Number(number)));
}

async function organizerPool(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  poolId: string,
  lottery: string,
) {
  if (poolId) {
    const { data } = await admin
      .from("pools")
      .select("id,owner_id")
      .eq("id", poolId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    return data ?? null;
  }

  const { data } = await admin
    .from("pools")
    .select("id,owner_id")
    .eq("owner_id", ownerId)
    .eq("lottery", lottery)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lottery = String(body.lottery ?? "");
    const contest = Number(body.contest);
    const sourceContest = Number(body.sourceContest);
    const poolId = String(body.poolId ?? "");
    const numbers = body.numbers;
    const secondDrawNumbers = body.secondDrawNumbers ?? [];
    const trevos = body.trevos ?? [];
    const checkedGames = Array.isArray(body.checkedGames) ? body.checkedGames : [];
    const totalCostCents = Math.max(0, Math.round(Number(body.totalCostCents ?? 0)));
    const receivedPrizeCents =
      body.receivedPrizeCents == null || body.receivedPrizeCents === ""
        ? null
        : Math.max(0, Math.round(Number(body.receivedPrizeCents)));

    if (
      !isSupportedLottery(lottery) ||
      !Number.isInteger(contest) ||
      contest < 1 ||
      !validNumbers(numbers) ||
      !validNumbers(secondDrawNumbers) ||
      !validNumbers(trevos) ||
      !Array.isArray(checkedGames) ||
      !Number.isFinite(totalCostCents) ||
      (receivedPrizeCents != null && !Number.isFinite(receivedPrizeCents))
    ) {
      return NextResponse.json({ error: "Resultado manual inválido." }, { status: 400 });
    }

    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      return NextResponse.json({ error: "Faça login como organizador." }, { status: 401 });

    const admin = createAdminClient();
    const pool = await organizerPool(admin, auth.user.id, poolId, lottery);
    if (!pool)
      return NextResponse.json({ error: "Bolão não encontrado para este resultado." }, { status: 404 });

    const { data, error } = await admin
      .from("manual_lottery_results")
      .upsert(
        {
          owner_id: auth.user.id,
          pool_id: pool.id,
          lottery,
          contest_number: contest,
          source_contest_number:
            Number.isInteger(sourceContest) && sourceContest > 0 ? sourceContest : null,
          numbers: numbers.map(Number),
          second_draw_numbers: secondDrawNumbers.map(Number),
          trevos: trevos.map(Number),
          checked_games: checkedGames,
          total_cost_cents: totalCostCents,
          received_prize_cents: receivedPrizeCents,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "pool_id,lottery,contest_number" },
      )
      .select("id,pool_id,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({
      ok: true,
      id: data.id,
      poolId: data.pool_id,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error("save-manual-lottery-result:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o resultado manual." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const lottery = String(body.lottery ?? "");
    const poolId = String(body.poolId ?? "");

    if (!isSupportedLottery(lottery) || !poolId)
      return NextResponse.json(
        { error: "Bolão ou modalidade inválida." },
        { status: 400 },
      );

    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      return NextResponse.json(
        { error: "Faça login como organizador." },
        { status: 401 },
      );

    const admin = createAdminClient();
    const pool = await organizerPool(admin, auth.user.id, poolId, lottery);
    if (!pool)
      return NextResponse.json(
        { error: "Bolão não encontrado para este resultado." },
        { status: 404 },
      );

    const { error, count } = await admin
      .from("manual_lottery_results")
      .delete({ count: "exact" })
      .eq("owner_id", auth.user.id)
      .eq("pool_id", pool.id)
      .eq("lottery", lottery);

    if (error) throw error;
    return NextResponse.json({ ok: true, removed: count ?? 0 });
  } catch (error) {
    console.error("delete-manual-lottery-result:", error);
    return NextResponse.json(
      { error: "Não foi possível retirar a conferência publicada." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const lottery = request.nextUrl.searchParams.get("lottery") ?? "";
    const contest = Number(request.nextUrl.searchParams.get("contest"));
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const requestedPoolId = request.nextUrl.searchParams.get("pool") ?? "";

    if (!isSupportedLottery(lottery) || !Number.isInteger(contest) || contest < 1)
      return NextResponse.json({ error: "Modalidade ou concurso inválido." }, { status: 400 });

    const admin = createAdminClient();
    let ownerId = "";
    let poolId = "";

    if (token) {
      const { data: participant } = await admin
        .from("participants")
        .select("pool_id,status")
        .eq("access_token", token)
        .maybeSingle();
      if (!participant || participant.status === "cancelled")
        return NextResponse.json({ error: "Participante inválido." }, { status: 404 });

      poolId = String(participant.pool_id);
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
      if (ownerId) {
        const pool = await organizerPool(admin, ownerId, requestedPoolId, lottery);
        poolId = String(pool?.id ?? "");
      }
    }

    if (!ownerId || !poolId)
      return NextResponse.json({ available: false, lottery, contest });

    const { data, error } = await admin
      .from("manual_lottery_results")
      .select(
        "pool_id,lottery,contest_number,source_contest_number,numbers,second_draw_numbers,trevos,checked_games,total_cost_cents,received_prize_cents,updated_at",
      )
      .eq("pool_id", poolId)
      .eq("lottery", lottery)
      .eq("contest_number", contest)
      .maybeSingle();

    if (error) throw error;
    if (!data)
      return NextResponse.json({ available: false, lottery, contest });

    return NextResponse.json({
      available: true,
      source: "manual-organizer",
      poolId: data.pool_id,
      lottery: data.lottery,
      contest: Number(data.contest_number),
      sourceContest: Number(data.source_contest_number || data.contest_number),
      numbers: Array.isArray(data.numbers) ? data.numbers.map(Number) : [],
      secondDrawNumbers: Array.isArray(data.second_draw_numbers)
        ? data.second_draw_numbers.map(Number)
        : [],
      trevos: Array.isArray(data.trevos) ? data.trevos.map(Number) : [],
      checkedGames: Array.isArray(data.checked_games) ? data.checked_games : [],
      totalCostCents: Number(data.total_cost_cents || 0),
      receivedPrizeCents:
        data.received_prize_cents == null ? null : Number(data.received_prize_cents),
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
