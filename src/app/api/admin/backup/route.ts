import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const poolId = request.nextUrl.searchParams.get("pool");
  if (!poolId)
    return NextResponse.json(
      { error: "Bolão não informado." },
      { status: 400 },
    );
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data: pool } = await supabase
    .from("pools")
    .select("*")
    .eq("id", poolId)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!pool)
    return NextResponse.json(
      { error: "Bolão não autorizado." },
      { status: 403 },
    );
  const [participants, payments, wallet, games, audit] = await Promise.all([
    supabase.from("participants").select("*").eq("pool_id", poolId),
    supabase.from("payments").select("*").eq("pool_id", poolId),
    supabase.from("wallet_transactions").select("*").eq("pool_id", poolId),
    supabase.from("games").select("*").eq("pool_id", poolId),
    supabase.from("audit_events").select("*").eq("pool_id", poolId),
  ]);
  if (
    [participants, payments, wallet, games, audit].some(
      (result) => result.error,
    )
  )
    return NextResponse.json(
      { error: "Não foi possível montar o backup." },
      { status: 500 },
    );
  const body = {
    format: "bolao-amigos-btp-backup",
    version: 1,
    generated_at: new Date().toISOString(),
    pool,
    participants: participants.data ?? [],
    payments: payments.data ?? [],
    wallet_transactions: wallet.data ?? [],
    games: games.data ?? [],
    audit_events: audit.data ?? [],
  };
  const safeTitle = String(pool.title)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .toLowerCase();
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="backup-${safeTitle}.json"`,
      "cache-control": "no-store",
    },
  });
}
