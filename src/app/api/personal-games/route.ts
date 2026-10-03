
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!token) return NextResponse.json({ error: "Participante inválido." }, { status: 400 });

    const admin = createAdminClient();
    const { data: participant } = await admin
      .from("participants")
      .select("id,pool_id,status")
      .eq("access_token", token)
      .maybeSingle();
    if (!participant || participant.status === "cancelled")
      return NextResponse.json({ error: "Participante inválido." }, { status: 404 });

    const { data, error } = await admin
      .from("personal_saved_games")
      .select("id,lottery,contest_number,games,created_at")
      .eq("participant_id", participant.id)
      .eq("pool_id", participant.pool_id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      games: (data ?? []).map((row) => ({
        id: row.id,
        lottery: row.lottery,
        contest: row.contest_number,
        games: row.games,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("load-personal-games:", error);
    return NextResponse.json({ error: "Não foi possível carregar os jogos deste participante." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { savedGameContest } from "@/lib/saved-game-contest";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportedLottery, type PersonalGame } from "@/lib/personal-game-prizes";
import { syncLatestLotteryResult } from "@/lib/lottery-results/sync";
import { withStableGameReferences } from "@/lib/game-reference";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const lottery = String(body.lottery ?? "");
    const requestedContest = Number(body.contest);
    const games = body.games as PersonalGame[];

    if (
      !token ||
      !isSupportedLottery(lottery) ||
      !Array.isArray(games) ||
      games.length < 1 ||
      games.length > 5000 ||
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

    const { data: pool } = await admin.from("pools").select("lottery,contest_number").eq("id", participant.pool_id).maybeSingle();
    let contest = savedGameContest({ requested: requestedContest, latest: latest?.contest_number, lottery, poolLottery: pool?.lottery, poolContest: pool?.contest_number });
    if (!contest) {
      try { contest = savedGameContest({ requested: null, latest: await syncLatestLotteryResult(lottery), lottery }); }
      catch (error) { console.error("sync-latest-before-save:", error); }
    }
    if (!contest)
      return NextResponse.json({ error: "Informe o número do concurso no campo acima de Salvar jogo. Seus jogos continuam nesta tela." }, { status: 503 });

    const gameKey = (game: PersonalGame) =>
      `${[...game.numbers].map(Number).sort((a, b) => a - b).join("-")}|${[...(game.trevos ?? [])].map(Number).sort((a, b) => a - b).join("-")}`;

    const { data: previousRows, error: previousError } = await admin
      .from("personal_saved_games")
      .select("games")
      .eq("participant_id", participant.id)
      .eq("pool_id", participant.pool_id)
      .eq("lottery", lottery);
    if (previousError) throw previousError;

    const existingKeys = new Set<string>();
    for (const row of previousRows ?? []) {
      if (!Array.isArray(row.games)) continue;
      for (const game of row.games as PersonalGame[]) existingKeys.add(gameKey(game));
    }

    const uniqueGames: PersonalGame[] = [];
    const batchKeys = new Set<string>();
    for (const game of games) {
      const key = gameKey(game);
      if (existingKeys.has(key) || batchKeys.has(key)) continue;
      batchKeys.add(key);
      uniqueGames.push(game);
    }
    const duplicates = games.length - uniqueGames.length;

    if (!uniqueGames.length)
      return NextResponse.json({
        ok: true,
        contest,
        savedCount: 0,
        duplicateCount: duplicates,
        allDuplicates: true,
      });

    const { data, error } = await admin
      .from("personal_saved_games")
      .insert({
        participant_id: participant.id,
        pool_id: participant.pool_id,
        lottery,
        contest_number: contest,
        games: withStableGameReferences(uniqueGames),
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({
      ok: true,
      id: data.id,
      contest,
      savedCount: uniqueGames.length,
      duplicateCount: duplicates,
    });
  } catch (error) {
    console.error("save-personal-game:", error);
    return NextResponse.json(
      { error: "Não foi possível ativar a conferência em segundo plano." },
      { status: 500 },
    );
  }
}


export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const id = String(body.id ?? "");
    if (!token || !id)
      return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });

    const admin = createAdminClient();
    const { data: participant } = await admin
      .from("participants")
      .select("id,pool_id,status")
      .eq("access_token", token)
      .maybeSingle();
    if (!participant || participant.status === "cancelled")
      return NextResponse.json({ error: "Participante inválido." }, { status: 404 });

    const { error } = await admin
      .from("personal_saved_games")
      .delete()
      .eq("id", id)
      .eq("participant_id", participant.id)
      .eq("pool_id", participant.pool_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete-personal-game:", error);
    return NextResponse.json({ error: "Não foi possível excluir o jogo." }, { status: 500 });
  }
}
