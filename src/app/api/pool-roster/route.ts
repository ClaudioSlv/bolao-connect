import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rosterAvailable } from "@/lib/pool-roster";
import { makePoolRosterPdf, type ClosedRoster, type ClosedRosterEntry } from "@/lib/pool-roster-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const token = query.get("token"), requestedPool = query.get("pool");
  const admin = createAdminClient();
  let poolId: string;
  if (token && uuid.test(token)) {
    const { data: participant } = await admin.from("participants").select("pool_id").eq("access_token", token).maybeSingle();
    if (!participant) return NextResponse.json({ error: "Participante inválido." }, { status: 404 });
    poolId = participant.pool_id;
  } else {
    if (!requestedPool || !uuid.test(requestedPool)) return NextResponse.json({ error: "Bolão inválido." }, { status: 400 });
    const client = await createClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
    const { data: owned } = await client.from("pools").select("id").eq("id", requestedPool).eq("owner_id", auth.user.id).maybeSingle();
    if (!owned) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    poolId = owned.id;
  }
  const { data: pool, error: poolError } = await admin.from("pools").select("payment_deadline,waitlist_payment_deadline").eq("id", poolId).single();
  if (poolError || !pool) return NextResponse.json({ error: "Bolão não encontrado." }, { status: 404 });
  if (!rosterAvailable(pool)) return NextResponse.json({ error: "A lista estará disponível após o prazo final de pagamento, incluindo a lista de espera." }, { status: 409 });
  const { error: closeError } = await admin.rpc("close_pool_roster", { p_pool_id: poolId });
  if (closeError) return NextResponse.json({ error: "Não foi possível preparar a lista. Tente novamente." }, { status: 503 });
  const [{ data: roster }, { data: rows, error: rowsError }] = await Promise.all([
    admin.from("pool_closed_rosters").select("pool_id,title,lottery,contest_number,payment_deadline,closed_at").eq("pool_id", poolId).single(),
    admin.from("pool_closed_roster_entries").select("participant_id,name,shares,recorded_at,late_bank_confirmation,is_organizer_free_share").eq("pool_id", poolId).order("name").order("participant_id"),
  ]);
  if (!roster || rowsError) return NextResponse.json({ error: "Não foi possível carregar a lista." }, { status: 503 });
  const entries = (rows ?? []) as ClosedRosterEntry[];
  const hash = createHash("sha256").update(JSON.stringify({ roster, entries })).digest("hex");
  const logo = new Uint8Array(await readFile(path.join(process.cwd(), "public/juntasorte-pdf-logo.png")));
  const bytes = await makePoolRosterPdf(roster as ClosedRoster, entries, hash, logo);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="juntasorte-participantes-${roster.contest_number ?? poolId}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
