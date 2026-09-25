import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileEfiParticipant } from "@/app/api/payments/efi/status/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = createAdminClient();
  const { data: sessions, error } = await s
    .from("payment_checkout_sessions")
    .select("participant_id")
    .eq("provider", "efi")
    .in("status", ["pending", "processing", "review_required"])
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set((sessions ?? []).map((x) => x.participant_id).filter(Boolean))];
  let checked = 0, paid = 0;

  for (const id of ids) {
    const { data: p } = await s.from("participants").select("access_token").eq("id", id).maybeSingle();
    if (!p?.access_token) continue;
    const response = await reconcileEfiParticipant(p.access_token);
    const body = await response.clone().json().catch(() => ({}));
    checked++;
    if (body?.paid) paid++;
  }

  return NextResponse.json({ ok: true, checked, paid });
}
