import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowed = (rows: unknown, poolId: string) =>
  Array.isArray(rows) ? rows.filter((r: any) => r && r.pool_id === poolId) : [];
export async function POST(request: NextRequest) {
  const poolId = request.nextUrl.searchParams.get("pool");
  if (!poolId)
    return NextResponse.json(
      { error: "Bolão não informado." },
      { status: 400 },
    );
  const s = await createClient();
  const { data: auth } = await s.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { data: pool } = await s
    .from("pools")
    .select("id,owner_id")
    .eq("id", poolId)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!pool)
    return NextResponse.json(
      { error: "Bolão não autorizado." },
      { status: 403 },
    );
  let backup: any;
  try {
    backup = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Arquivo JSON inválido." },
      { status: 400 },
    );
  }
  if (
    backup?.format !== "bolao-amigos-btp-backup" ||
    backup?.version !== 1 ||
    backup?.pool?.id !== poolId
  )
    return NextResponse.json(
      { error: "Este arquivo não pertence ao bolão selecionado." },
      { status: 400 },
    );
  const groups = [
    ["participants", allowed(backup.participants, poolId)],
    ["payments", allowed(backup.payments, poolId)],
    ["wallet_transactions", allowed(backup.wallet_transactions, poolId)],
    ["games", allowed(backup.games, poolId)],
  ] as const;
  let restored = 0;
  for (const [table, rows] of groups)
    if (rows.length) {
      const { error } = await s
        .from(table)
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error)
        return NextResponse.json(
          { error: `Falha ao restaurar ${table}.` },
          { status: 409 },
        );
      restored += rows.length;
    }
  await s
    .from("audit_events")
    .insert({
      pool_id: poolId,
      actor_id: auth.user.id,
      event_type: "backup_restored",
      entity_type: "pool",
      entity_id: poolId,
      details: { attempted_records: restored },
    });
  return NextResponse.json({ ok: true, restored });
}
