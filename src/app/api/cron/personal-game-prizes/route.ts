import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchOfficialPersonalDraw,
  findWinningGames,
  isSupportedLottery,
  type PersonalGame,
} from "@/lib/personal-game-prizes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

function configurePush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@bolao-connect.app",
    publicKey,
    privateKey,
  );
  return true;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("personal_saved_games")
    .delete()
    .lte("expires_at", new Date().toISOString());

  const { data: rows, error } = await admin
    .from("personal_saved_games")
    .select("id,participant_id,lottery,contest_number,games")
    .is("checked_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;

  const drawCache = new Map<string, Awaited<ReturnType<typeof fetchOfficialPersonalDraw>>>();
  let checked = 0;
  let winners = 0;
  let sent = 0;
  let disabled = 0;

  for (const row of rows ?? []) {
    if (!isSupportedLottery(row.lottery)) continue;
    const key = `${row.lottery}:${row.contest_number}`;
    let draw = drawCache.get(key);
    if (!draw) {
      try {
        draw = await fetchOfficialPersonalDraw(row.lottery, Number(row.contest_number));
        drawCache.set(key, draw);
      } catch {
        continue;
      }
    }
    if (!draw.available) continue;

    const winningGames = findWinningGames(
      row.lottery,
      (Array.isArray(row.games) ? row.games : []) as PersonalGame[],
      draw,
    );
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + TEN_DAYS_MS).toISOString();
    const best = winningGames.reduce(
      (current, winner) =>
        !current || winner.prize.value > current.prize.value ? winner : current,
      winningGames[0],
    );

    await admin
      .from("personal_saved_games")
      .update({
        checked_at: now,
        expires_at: expiresAt,
        prize_summary: best
          ? {
              contest: draw.contest,
              lottery: row.lottery,
              winning_games: winningGames.length,
              best_hits: best.hits,
              best_label: best.prize.label,
              best_value: best.prize.value,
            }
          : null,
      })
      .eq("id", row.id);
    checked++;

    if (!best) continue;
    winners++;

    const { data: participant } = await admin
      .from("participants")
      .select("name,access_token,status")
      .eq("id", row.participant_id)
      .maybeSingle();
    if (!participant || participant.status === "cancelled") continue;

    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("participant_id", row.participant_id)
      .eq("enabled", true);
    if (!subscriptions?.length || !configurePush()) continue;

    const payload = JSON.stringify({
      title: "🎉 Parabéns, você foi premiado!",
      body: `${participant.name}, seu jogo foi premiado no concurso ${draw.contest}. Toque para conferir os acertos.`,
      url: `/meus-jogos-salvos?voltar=${encodeURIComponent(`/p/${participant.access_token}`)}`,
      tag: `premio-${row.id}-${draw.contest}`,
    });

    let delivered = false;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
        delivered = true;
        sent++;
      } catch (pushError: any) {
        if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
          await admin
            .from("push_subscriptions")
            .update({ enabled: false, updated_at: now })
            .eq("id", subscription.id);
          disabled++;
        }
      }
    }
    if (delivered)
      await admin
        .from("personal_saved_games")
        .update({ notified_at: now })
        .eq("id", row.id);
  }

  return NextResponse.json({ ok: true, checked, winners, sent, disabled });
}
