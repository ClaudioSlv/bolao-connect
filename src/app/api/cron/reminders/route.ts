import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEXT_POOL_PRELAUNCH } from "@/lib/next-pool";
import { DEFAULT_APP_BRAND, getOrganizerBrand } from "@/lib/organizer-brand";

export const dynamic = "force-dynamic";
const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    priv = process.env.VAPID_PRIVATE_KEY,
    subject = process.env.VAPID_SUBJECT || "mailto:admin@bolao-connect.app";
  if (!pub || !priv)
    return NextResponse.json(
      { error: "VAPID not configured" },
      { status: 500 },
    );
  webpush.setVapidDetails(subject, pub, priv);
  const s = createAdminClient();
  let sent = 0,
    disabled = 0,
    skipped = 0,
    timerSent = 0,
    timerDisabled = 0,
    timerSkipped = 0,
    prelaunchSent = 0,
    prelaunchDisabled = 0,
    prelaunchSkipped = 0;
  const now = Date.now();

  const { data: subs, error } = await s
    .from("push_subscriptions")
    .select(
      "id,pool_id,participant_id,endpoint,p256dh,auth,last_sent_at,created_at",
    )
    .eq("enabled", true)
    .limit(500);
  if (error) throw error;
  for (const sub of subs ?? []) {
    const { data: p } = await s
      .from("participants")
      .select("name,status,payment_status,access_token")
      .eq("id", sub.participant_id)
      .maybeSingle();
    if (!p || p.status === "cancelled" || p.status === "waitlisted") {
      if (!p || p.status === "cancelled")
        await s
          .from("push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      disabled++;
      continue;
    }
    const { data: pool } = await s
      .from("pools")
      .select(
        "owner_id,title,payment_opens_at,payment_deadline,status,public_slug",
      )
      .eq("id", sub.pool_id)
      .maybeSingle();
    if (
      !pool ||
      ["drawn", "archived"].includes(pool.status) ||
      new Date(pool.payment_deadline).getTime() <= now
    ) {
      skipped++;
      continue;
    }
    const opensAt = pool.payment_opens_at
      ? new Date(pool.payment_opens_at).getTime()
      : 0;
    if (opensAt && opensAt > now) {
      skipped++;
      continue;
    }
    const lastSentAt = sub.last_sent_at
      ? new Date(sub.last_sent_at).getTime()
      : 0;
    const openingNotice = !lastSentAt || lastSentAt < opensAt;
    const anchor = sub.last_sent_at || sub.created_at;
    if (p.payment_status === "confirmed" && !openingNotice) {
      skipped++;
      continue;
    }
    if (
      !openingNotice &&
      anchor &&
      now - new Date(anchor).getTime() < TEN_DAYS
    ) {
      skipped++;
      continue;
    }
    const brand = await getOrganizerBrand(s, pool.owner_id);
    const payload = JSON.stringify({
      title: openingNotice ? "🟢 Pagamento liberado!" : `🍀 ${brand.name}`,
      body: openingNotice
        ? `${p.name}, toque aqui para pagar sua cota do ${pool.title}.`
        : `${p.name}, não esqueça o pagamento do bolão ${pool.title}.`,
      url: `/p/${p.access_token}`,
      tag: `bolao-${sub.pool_id}`,
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      await s
        .from("push_subscriptions")
        .update({
          last_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await s
          .from("push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        disabled++;
      }
    }
  }

  const { data: timerSubs, error: timerError } = await s
    .from("timer_push_subscriptions")
    .select("id,pool_id,endpoint,p256dh,auth,last_sent_at,created_at")
    .eq("enabled", true)
    .limit(500);
  if (!timerError) {
    for (const sub of timerSubs ?? []) {
      const { data: pool } = await s
        .from("pools")
        .select(
          "owner_id,title,payment_opens_at,payment_deadline,status,public_slug",
        )
        .eq("id", sub.pool_id)
        .maybeSingle();
      if (!pool || ["drawn", "archived"].includes(pool.status)) {
        await s
          .from("timer_push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        timerDisabled++;
        continue;
      }
      const opensAt = pool.payment_opens_at
        ? new Date(pool.payment_opens_at).getTime()
        : NaN;
      if (!Number.isFinite(opensAt)) {
        await s
          .from("timer_push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        timerDisabled++;
        continue;
      }
      if (opensAt <= now) {
        const { data: participantSub } = await s
          .from("push_subscriptions")
          .select("id")
          .eq("pool_id", sub.pool_id)
          .eq("endpoint", sub.endpoint)
          .eq("enabled", true)
          .limit(1)
          .maybeSingle();
        if (participantSub) {
          await s
            .from("timer_push_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          timerDisabled++;
          continue;
        }
        const brand = await getOrganizerBrand(s, pool.owner_id);
        const openingPayload = JSON.stringify({
          title: "🟢 Pagamentos liberados!",
          body: `O temporizador zerou. Os pagamentos do ${pool.title} já estão abertos.`,
          url: `/bolao/${pool.public_slug}`,
          tag: `abertura-${sub.pool_id}`,
        });
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            openingPayload,
          );
          await s
            .from("timer_push_subscriptions")
            .update({
              enabled: false,
              last_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
          timerSent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await s
              .from("timer_push_subscriptions")
              .update({ enabled: false, updated_at: new Date().toISOString() })
              .eq("id", sub.id);
            timerDisabled++;
          }
        }
        continue;
      }
      const anchor = sub.last_sent_at || sub.created_at;
      if (anchor && now - new Date(anchor).getTime() < TEN_DAYS) {
        timerSkipped++;
        continue;
      }
      const days = Math.max(
          1,
          Math.ceil((opensAt - now) / (24 * 60 * 60 * 1000)),
        ),
        brand = await getOrganizerBrand(s, pool.owner_id),
        payload = JSON.stringify({
          title: `🍀 ${brand.name}`,
          body: `Faltam ${days} dias para a abertura dos pagamentos do ${pool.title}.`,
          url: `/temporizador/${pool.public_slug}`,
          tag: `timer-${sub.pool_id}`,
        });
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        await s
          .from("timer_push_subscriptions")
          .update({
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
        timerSent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await s
            .from("timer_push_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          timerDisabled++;
        }
      }
    }
  }

  const { data: prelaunchSubs, error: prelaunchError } = await s
    .from("prelaunch_push_subscriptions")
    .select("id,campaign_key,endpoint,p256dh,auth,last_sent_at,created_at")
    .eq("enabled", true)
    .limit(500);
  if (!prelaunchError) {
    const opensAt = new Date(NEXT_POOL_PRELAUNCH.opensAt).getTime();
    for (const sub of prelaunchSubs ?? []) {
      if (
        sub.campaign_key !== NEXT_POOL_PRELAUNCH.key ||
        !Number.isFinite(opensAt) ||
        opensAt <= now
      ) {
        await s
          .from("prelaunch_push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        prelaunchDisabled++;
        continue;
      }
      const anchor = sub.last_sent_at || sub.created_at;
      if (anchor && now - new Date(anchor).getTime() < TEN_DAYS) {
        prelaunchSkipped++;
        continue;
      }
      const days = Math.max(
          1,
          Math.ceil((opensAt - now) / (24 * 60 * 60 * 1000)),
        ),
        payload = JSON.stringify({
          title: `🍀 ${DEFAULT_APP_BRAND}`,
          body: `Faltam ${days} dias para a abertura do próximo bolão: ${NEXT_POOL_PRELAUNCH.title}.`,
          url: "/temporizador",
          tag: `prelaunch-${NEXT_POOL_PRELAUNCH.key}`,
        });
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        await s
          .from("prelaunch_push_subscriptions")
          .update({
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
        prelaunchSent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await s
            .from("prelaunch_push_subscriptions")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          prelaunchDisabled++;
        }
      }
    }
  }
  return NextResponse.json({
    ok: true,
    sent,
    disabled,
    skipped,
    timerSent,
    timerDisabled,
    timerSkipped,
    timerTableReady: !timerError,
    prelaunchSent,
    prelaunchDisabled,
    prelaunchSkipped,
    prelaunchTableReady: !prelaunchError,
  });
}
