import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOTTERY_LABELS } from "@/lib/lottery-pricing";
import type { LotteryId } from "@/lib/domain";

export async function sendNewPoolPush(input: {
  ownerId: string;
  poolId: string;
  lottery: LotteryId;
  publicSlug: string;
}) {
  const s = createAdminClient();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@bolao-connect.app",
    publicKey,
    privateKey,
  );

  const { data: previousPools } = await s
    .from("pools")
    .select("id")
    .eq("owner_id", input.ownerId)
    .neq("id", input.poolId);
  const poolIds = (previousPools ?? []).map((pool) => pool.id);
  if (!poolIds.length) return { sent: 0, failed: 0 };

  const { data: participants } = await s
    .from("participants")
    .select("id,name,phone")
    .in("pool_id", poolIds)
    .neq("status", "cancelled");
  const participantIds = (participants ?? []).map(
    (participant) => participant.id,
  );
  if (!participantIds.length) return { sent: 0, failed: 0 };

  const { data: subscriptions } = await s
    .from("push_subscriptions")
    .select("id,participant_id,endpoint,p256dh,auth")
    .in("participant_id", participantIds)
    .eq("enabled", true);
  const participantById = new Map(
    (participants ?? []).map((participant) => [participant.id, participant]),
  );
  const uniqueEndpoints = new Map<string, any>();
  for (const subscription of subscriptions ?? []) {
    if (!uniqueEndpoints.has(subscription.endpoint))
      uniqueEndpoints.set(subscription.endpoint, subscription);
  }

  let sent = 0;
  let failed = 0;
  const modality = LOTTERY_LABELS[input.lottery];
  await Promise.all(
    [...uniqueEndpoints.values()].map(async (subscription: any) => {
      const participant = participantById.get(subscription.participant_id);
      const query = new URLSearchParams({
        name: participant?.name ?? "",
        phone: participant?.phone ?? "",
      });
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: "Novo bolão disponível",
            body: `Novo bolão da modalidade ${modality} disponível. Toque para participar.`,
            url: `/bolao/${input.publicSlug}/entrar?${query.toString()}`,
            tag: `novo-bolao-${input.poolId}`,
          }),
        );
        sent++;
        await s
          .from("push_subscriptions")
          .update({
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      } catch (error: any) {
        failed++;
        if (error?.statusCode === 404 || error?.statusCode === 410)
          await s
            .from("push_subscriptions")
            .update({ enabled: false })
            .eq("id", subscription.id);
      }
    }),
  );
  await s.from("audit_events").insert({
    pool_id: input.poolId,
    event_type: "new_pool_push",
    entity_type: "pool",
    entity_id: input.poolId,
    details: { modality, sent, failed },
  });
  return { sent, failed };
}
