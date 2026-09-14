import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportedLottery, type PersonalGame } from "@/lib/personal-game-prizes";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const lottery = String(body.lottery ?? "");
    const contest = Number(body.contest);
    const games = body.games as PersonalGame[];

    if (
      !token ||
      !isSupportedLottery(lottery) ||
      !Number.isInteger(contest) ||
      contest < 1 ||
      !Array.isArray(games) ||
      games.length < 1 ||
      games.length > 1000 ||
      games.some(
        (game) =>
          !Array.isArray(game?.numbers) ||
          !game.numbers.length ||
          game.numbers.some((number) => !Number.isInteger(Number(number))),
      )
    )
      return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });

    const admin = createAdminClient();
    const { data: participant } = await admin
      .from("participants")
      .select("id,pool_id,status")
      .eq("access_token", token)
      .maybeSingle();

    if (!participant || participant.status === "cancelled")
      return NextResponse.json({ error: "Participante inválido." }, { status: 404 });

    const { data: latest } = await admin
      .from("lottery_results")
      .select("contest_number")
      .eq("lottery", lottery)
      .order("contest_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const expectedContest = Number(latest?.contest_number ?? 0) + 1;
    if (expectedContest > 1 && contest !== expectedContest)
      return NextResponse.json(
        { error: `Este jogo deve ser vinculado ao concurso atual ${expectedContest}.` },
        { status: 409 },
      );

    const { data, error } = await admin
      .from("personal_saved_games")
      .insert({
        participant_id: participant.id,
        pool_id: participant.pool_id,
        lottery,
        contest_number: contest,
        games,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("save-personal-game:", error);
    return NextResponse.json(
      { error: "Não foi possível ativar a conferência em segundo plano." },
      { status: 500 },
    );
  }
}
