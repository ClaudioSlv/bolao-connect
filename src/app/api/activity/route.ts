import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string };
    if (!token) return NextResponse.json({ ok: false }, { status: 400 });
    const admin = createAdminClient();
    const { data: participant } = await admin.from("participants").select("id,pool_id,name,status").eq("access_token", token).maybeSingle();
    if (!participant || participant.status === "cancelled") return NextResponse.json({ ok: false }, { status: 404 });
    const duplicateWindow = new Date(Date.now() - 15_000).toISOString();
    const { data: recent } = await admin.from("audit_events").select("id").eq("pool_id", participant.pool_id).eq("entity_id", participant.id).eq("event_type", "participant_app_opened").gte("created_at", duplicateWindow).limit(1).maybeSingle();
    if (!recent) await admin.from("audit_events").insert({ pool_id: participant.pool_id, event_type: "participant_app_opened", entity_type: "participant", entity_id: participant.id, details: { participant_name: participant.name } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("participant-activity:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { data: pools } = await supabase.from("pools").select("id").eq("owner_id", auth.user.id);
  const poolIds = (pools ?? []).map((pool) => pool.id);
  if (!poolIds.length) return NextResponse.json({ activities: [] });
  const requestedSince = new URL(request.url).searchParams.get("since");
  const parsedSince = requestedSince ? new Date(requestedSince) : new Date();
  const since = Number.isNaN(parsedSince.getTime()) ? new Date().toISOString() : parsedSince.toISOString();
  const { data, error } = await supabase.from("audit_events").select("id,event_type,details,created_at").in("pool_id", poolIds).in("event_type", ["participant_app_opened", "personal_game_prize"]).gt("created_at", since).order("created_at", { ascending: true }).limit(20);
  if (error) { console.error("organizer-activity:", error); return NextResponse.json({ activities: [] }, { status: 500 }); }
  return NextResponse.json({ activities: data ?? [] });
}
