import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage, logAppError } from "@/lib/app-error-log";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token ?? "");
    const subscription = body.subscription;
    const endpoint = String(subscription?.endpoint ?? body.endpoint ?? "");
    if (!token || !endpoint)
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

    const s = createAdminClient();
    const { data: p } = await s
      .from("participants")
      .select("id,pool_id,status")
      .eq("access_token", token)
      .maybeSingle();
    if (!p || p.status === "cancelled")
      return NextResponse.json(
        { error: "Participante indisponível." },
        { status: 404 },
      );

    if (body.action === "status") {
      const { data: existing } = await s
        .from("push_subscriptions")
        .select("id")
        .eq("participant_id", p.id)
        .eq("pool_id", p.pool_id)
        .eq("endpoint", endpoint)
        .eq("enabled", true)
        .maybeSingle();
      return NextResponse.json({ active: Boolean(existing) });
    }

    if (!subscription?.keys?.p256dh || !subscription?.keys?.auth)
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

    const { error } = await s.from("push_subscriptions").upsert(
      {
        pool_id: p.pool_id,
        participant_id: p.id,
        endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint,participant_id" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAppError({
      source: "Notificações - ativar lembrete",
      message: errorMessage(error),
    });
    return NextResponse.json(
      { error: "Não foi possível vincular os lembretes." },
      { status: 500 },
    );
  }
}
