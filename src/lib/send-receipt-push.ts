import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendReceiptPublishedPush(input: {
  poolId: string;
  receiptId: string;
  receiptTitle: string;
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

  const { data: participants } = await s
    .from("participants")
    .select("id,name,access_token")
    .eq("pool_id", input.poolId)
    .neq("status", "cancelled");
  const active = participants ?? [];
  if (!active.length) return { sent: 0, failed: 0 };

  const { data: subscriptions } = await s
    .from("push_subscriptions")
    .select("id,participant_id,endpoint,p256dh,auth")
    .in(
      "participant_id",
      active.map((participant) => participant.id),
    )
    .eq("enabled", true);
  const participantById = new Map(
    active.map((participant) => [participant.id, participant]),
  );
  let sent = 0;
  let failed = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      const participant = participantById.get(subscription.participant_id);
      if (!participant) return;
      const payload = JSON.stringify({
        title: "Novo comprovante disponível",
        body: `${participant.name}, ${input.receiptTitle} foi publicado. Toque para visualizar.`,
        url: `/p/${participant.access_token}/comprovantes`,
        tag: `comprovante-${input.receiptId}`,
      });
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
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
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await s
            .from("push_subscriptions")
            .update({
              enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);
        }
      }
    }),
  );

  await s.from("audit_events").insert({
    pool_id: input.poolId,
    event_type: "receipt_published_push",
    entity_type: "game_receipt",
    entity_id: input.receiptId,
    details: { sent, failed },
  });
  return { sent, failed };
}
