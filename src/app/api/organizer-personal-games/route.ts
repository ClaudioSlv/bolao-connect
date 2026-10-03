import { NextResponse } from "next/server";
import { savedGameContest } from "@/lib/saved-game-contest";
import { syncLatestLotteryResult } from "@/lib/lottery-results/sync";
import { isSupportedLottery } from "@/lib/personal-game-prizes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lottery = String(body.lottery ?? "");
    const games = Array.isArray(body.games) ? body.games : [];
    if (!isSupportedLottery(lottery) || !games.length || games.length > 5000)
      return NextResponse.json({ error: "Fechamento inválido." }, { status: 400 });
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Entre novamente como organizador." }, { status: 401 });
    const { data: result } = await supabase.from("lottery_results").select("contest_number").eq("lottery", lottery).order("contest_number", { ascending: false }).limit(1).maybeSingle();
    const { data: pools } = await supabase.from("pools").select("id,lottery,contest_number").eq("owner_id", auth.user.id).eq("lottery", lottery).neq("status", "archived").order("created_at", { ascending: false }).limit(1);
    const pool = pools?.[0];
    let contest = savedGameContest({ requested: body.contest, latest: result?.contest_number, lottery, poolLottery: pool?.lottery, poolContest: pool?.contest_number });
    if (!contest) {
      try { contest = savedGameContest({ requested: null, latest: await syncLatestLotteryResult(lottery), lottery }); }
      catch (error) { console.error("sync-organizer-contest:", error); }
    }
    if (!contest) return NextResponse.json({ error: "Informe o número do concurso no campo acima de Salvar jogo. Seus jogos continuam nesta tela." }, { status: 503 });
    const { data: saved, error } = await supabase.from("organizer_saved_game_closures").insert({ owner_id: auth.user.id, pool_id: pools?.[0]?.id ?? null, lottery, contest_number: contest, games }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: saved.id, contest, savedCount: games.length });
  } catch (error) {
    console.error("organizer-personal-games:", error);
    return NextResponse.json({ error: "Não foi possível salvar o fechamento no banco." }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ games: [] }, { status: 401 });
  const { data, error } = await supabase.from("organizer_saved_game_closures").select("id,lottery,contest_number,games,created_at").eq("owner_id", auth.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Não foi possível carregar os jogos." }, { status: 500 });
  return NextResponse.json({ games: data ?? [] });
}


export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Entre novamente como organizador." }, { status: 401 });
    const admin = createAdminClient();
    const { data: deleted, error } = await admin.from("organizer_saved_game_closures").delete().eq("id", id).eq("owner_id", auth.user.id).select("id");
    if (error) throw error;
    if (!deleted?.length) return NextResponse.json({ error: "Este jogo não foi encontrado no seu cadastro. Atualize a lista." }, { status: 404 });
    return NextResponse.json({ ok: true, deletedCount: deleted.length });
  } catch (error) {
    console.error("delete-organizer-personal-games:", error);
    return NextResponse.json({ error: "Não foi possível excluir o fechamento." }, { status: 500 });
  }
}
