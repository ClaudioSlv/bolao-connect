import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lottery = String(body.lottery ?? "");
    const games = Array.isArray(body.games) ? body.games : [];
    if (!lottery || !games.length || games.length > 5000)
      return NextResponse.json({ error: "Fechamento inválido." }, { status: 400 });
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Entre novamente como organizador." }, { status: 401 });
    const { data: result } = await supabase.from("lottery_results").select("contest_number").eq("lottery", lottery).order("contest_number", { ascending: false }).limit(1).maybeSingle();
    const contest = Number(result?.contest_number ?? 0) + 1;
    if (!contest) return NextResponse.json({ error: "Não foi possível identificar o próximo concurso." }, { status: 400 });
    const { data: pools } = await supabase.from("pools").select("id").eq("owner_id", auth.user.id).eq("lottery", lottery).neq("status", "archived").order("created_at", { ascending: false }).limit(1);
    const { error } = await supabase.from("organizer_saved_game_closures").insert({ owner_id: auth.user.id, pool_id: pools?.[0]?.id ?? null, lottery, contest_number: contest, games });
    if (error) throw error;
    return NextResponse.json({ ok: true, contest, savedCount: games.length });
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
