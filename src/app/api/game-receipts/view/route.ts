import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  const receiptId = String(body?.receiptId ?? "");
  if (!token || !receiptId)
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const s = createAdminClient();
  const { data: participant } = await s
    .from("participants")
    .select("id,name,pool_id,status")
    .eq("access_token", token)
    .maybeSingle();
  if (!participant || participant.status === "cancelled")
    return NextResponse.json({ error: "invalid participant" }, { status: 403 });

  const { data: receipt } = await s
    .from("game_receipts")
    .select("id")
    .eq("id", receiptId)
    .eq("pool_id", participant.pool_id)
    .eq("status", "published")
    .maybeSingle();
  if (!receipt)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: existing } = await s
    .from("audit_events")
    .select("id")
    .eq("event_type", "receipt_viewed")
    .eq("entity_id", receiptId)
    .contains("details", { participant_id: participant.id })
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await s.from("audit_events").insert({
      pool_id: participant.pool_id,
      event_type: "receipt_viewed",
      entity_type: "game_receipt",
      entity_id: receiptId,
      details: {
        participant_id: participant.id,
        participant_name: participant.name,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
