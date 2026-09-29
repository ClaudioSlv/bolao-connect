import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWaitlistPromotionPush } from "@/lib/push/participant-notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: pools, error } = await s
    .from("pools")
    .select("id,title,payment_deadline,waitlist_payment_deadline,status")
    .not("payment_deadline", "is", null)
    .lte("payment_deadline", nowIso)
    .not("status", "in", '("drawn","archived")');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let expired = 0;
  let promoted = 0;
  let awaitingRefund = 0;

  for (const pool of pools ?? []) {
    const { data, error: rpcError } = await s.rpc("process_payment_deadlines", {
      p_pool_id: pool.id,
      p_now: nowIso,
    });
    if (rpcError) {
      console.error("payment deadline processing failed", pool.id, rpcError);
      continue;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const expiredList = (row?.expired_ids ?? []) as string[];
    const promotedList = (row?.promoted_ids ?? []) as string[];
    expired += expiredList.length;
    promoted += promotedList.length;
    const { count, error: reviewError } = await s.from("participants")
      .select("id", { count: "exact", head: true })
      .eq("pool_id", pool.id).eq("status", "confirmed").eq("payment_status", "partial");
    if (reviewError) console.error("partial payment review count failed", pool.id, reviewError);
    else awaitingRefund += count ?? 0;
  }

  const { data: queuedPromotions, error: queueError } = await s.from("waitlist_promotion_outbox")
    .select("pool_id,participant_id").is("dispatched_at", null).order("created_at", { ascending: true }).limit(100);
  if (queueError) return NextResponse.json({ error: queueError.message }, { status: 500 });
  let notified = 0;
  for (const item of queuedPromotions ?? []) {
    try {
      await sendWaitlistPromotionPush(item.participant_id);
      await s.from("waitlist_promotion_outbox").update({ dispatched_at: new Date().toISOString() })
        .eq("pool_id", item.pool_id).eq("participant_id", item.participant_id).is("dispatched_at", null);
      notified++;
    } catch (error) {
      console.error("waitlist promotion push failed", item.participant_id, error);
    }
  }

  return NextResponse.json({ ok: true, expired, promoted, notified, awaitingRefund });
}
