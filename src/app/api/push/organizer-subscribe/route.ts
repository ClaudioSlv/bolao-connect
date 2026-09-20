import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Entre novamente como organizador." }, { status: 401 });
    const body = await request.json();
    const subscription = body.subscription;
    const endpoint = String(subscription?.endpoint ?? "");
    if (!endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth)
      return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
    const { error } = await supabase.from("organizer_push_subscriptions").upsert({
      owner_id: auth.user.id,
      endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("organizer-push-subscribe:", error);
    return NextResponse.json({ error: "Não foi possível ativar a notificação." }, { status: 500 });
  }
}
