import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentDeadlinePush, sendPaymentDeadlineReminderPush, sendWaitlistPromotionPush } from "@/lib/push/participant-notifications";
import {processPendingEfiRefunds} from "@/lib/efi-refunds";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Às 10:30 de Brasília, avisa quem ainda não pagou e vence hoje.
  const saoPaulo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const startToday = new Date(`${saoPaulo}T00:00:00-03:00`).toISOString();
  const endToday = new Date(`${saoPaulo}T23:59:59-03:00`).toISOString();
  const { data: dueToday } = await s.from("pools")
    .select("id,title,payment_deadline,status")
    .gte("payment_deadline", startToday).lte("payment_deadline", endToday)
    .not("status", "in", '("drawn","archived")');
  let reminderNotified = 0;
  for (const pool of dueToday ?? []) {
    const { data: participants } = await s.from("participants")
      .select("id,is_test,payment_status,status")
      .eq("pool_id", pool.id).eq("status", "confirmed").eq("is_test", false)
      .neq("payment_status", "confirmed");
    for (const participant of participants ?? []) {
      try {
        const result = await sendPaymentDeadlineReminderPush(participant.id, pool.payment_deadline);
        if (result.sent > 0) reminderNotified += result.sent;
      } catch (error) {
        console.error("payment deadline reminder push failed", participant.id, error);
      }
    }
  }
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

  const {error:queueError} = await s.rpc("queue_payment_deadline_pushes");
  if(queueError)console.error("payment deadline push queue failed",queueError);
  let deadlineNotified=0;
  if(!queueError){
    const {data:deadlineNotices,error:noticeError}=await s.from("payment_deadline_push_outbox")
      .select("participant_id,deadline").is("dispatched_at",null).lte("deadline",new Date(now.getTime()-60*60*1000).toISOString()).order("created_at",{ascending:true}).limit(100);
    if(noticeError)console.error("payment deadline push lookup failed",noticeError);
    for(const notice of deadlineNotices??[]){
      try{
        await sendPaymentDeadlinePush(notice.participant_id,notice.deadline);
        const {error:updateError}=await s.from("payment_deadline_push_outbox")
          .update({dispatched_at:new Date().toISOString()}).eq("participant_id",notice.participant_id)
          .eq("deadline",notice.deadline).is("dispatched_at",null);
        if(updateError)throw updateError;
        deadlineNotified++;
      }catch(error){console.error("payment deadline push failed",notice.participant_id,error)}
    }
  }

  const { data: queuedPromotions, error: promotionQueueError } = await s.from("waitlist_promotion_outbox")
    .select("pool_id,participant_id").is("dispatched_at", null).order("created_at", { ascending: true }).limit(100);
  if (promotionQueueError) return NextResponse.json({ error: promotionQueueError.message }, { status: 500 });
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

  const refundsChecked = await processPendingEfiRefunds(5);
  return NextResponse.json({ ok: true, expired, promoted, notified, reminderNotified, deadlineNotified, awaitingRefund, refundsChecked });
}
