import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinPoolForm } from "@/components/join-pool-form";
import { participantAccessCookieName } from "@/lib/participant-access-cookie";
import {
  DEFAULT_POOL_RULES,
  DEFAULT_POOL_RULES_VERSION,
} from "@/lib/pool-rules";
export const dynamic = "force-dynamic";
function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}
async function joinPool(form: FormData) {
  "use server";
  const slug = String(form.get("slug") ?? "").trim(),
    name = String(form.get("name") ?? "")
      .trim()
      .replace(/\s+/g, " "),
    phone = normalizePhone(String(form.get("phone") ?? "")),
    shares = Number(form.get("shares") || 1),
    acceptWaitlist = form.get("accept_waitlist") === "on",
    rulesAgreed = form.get("rules_agreed") === "on";
  if (!slug || name.length < 2 || name.length > 120)
    throw new Error("Informe seu nome corretamente.");
  if (phone.length < 10 || phone.length > 13)
    throw new Error("Informe um WhatsApp válido com DDD.");
  if (!Number.isInteger(shares) || shares < 1 || shares > 2)
    throw new Error("Cada participante pode adquirir no máximo 2 cotas.");
  if (!rulesAgreed)
    throw new Error("Abra, leia e aceite as Regras do Grupo para continuar.");
  const s = createAdminClient();
  const { data: pool } = await s
    .from("pools")
    .select("id,title,total_shares,rules_text,rules_version")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!pool) throw new Error("Bolão não encontrado.");
  const { data: existing } = await s
    .from("participants")
    .select("id,phone")
    .eq("pool_id", pool.id)
    .neq("status", "cancelled");
  if ((existing ?? []).some((participant) => normalizePhone(String(participant.phone ?? "")) === phone))
    throw new Error(
      "Este WhatsApp já possui cadastro neste bolão. Cada participante pode ter no máximo 2 cotas no mesmo cadastro.",
    );
  const { data: current } = await s
    .from("participants")
    .select("shares,status")
    .eq("pool_id", pool.id);
  const used = (current ?? [])
      .filter((p) => p.status === "confirmed")
      .reduce((sum, p) => sum + (Number(p.shares) || 0), 0),
    remaining = Math.max(0, Number(pool.total_shares) - used),
    partial = remaining > 0 && remaining < shares,
    fullyWaitlisted = remaining === 0;
  if ((partial || fullyWaitlisted) && !acceptWaitlist)
    redirect(
      `/bolao/${slug}/entrar?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&shares=${shares}&confirmWaitlist=1&remaining=${remaining}`,
    );
  const { data, error } = await s.rpc("join_pool_atomic", {
    p_pool_id: pool.id,
    p_name: name,
    p_phone: phone,
    p_shares: shares,
    p_accept_waitlist: acceptWaitlist,
  });
  if (error)
    throw new Error(
      error.message || "Não foi possível registrar sua participação.",
    );
  const participant = Array.isArray(data) ? data[0] : data;
  if (!participant?.access_token)
    throw new Error("Não foi possível gerar o acesso do participante.");
  const rulesText = pool.rules_text || DEFAULT_POOL_RULES,
    rulesVersion = Number(pool.rules_version || DEFAULT_POOL_RULES_VERSION);
  const { error: acceptanceError } = await s
    .from("pool_rule_acceptances")
    .upsert(
      {
        pool_id: pool.id,
        participant_id: participant.participant_id,
        rules_version: rulesVersion,
        rules_text: rulesText,
      },
      { onConflict: "pool_id,participant_id,rules_version" },
    );
  if (acceptanceError) {
    await s.from("participants").delete().eq("id", participant.participant_id);
    throw new Error(
      "Não foi possível registrar o aceite das regras. A vaga não foi reservada.",
    );
  }
  const confirmedShares = Number(participant.confirmed_shares || 0),
    waitlistedShares = Number(participant.waitlisted_shares || 0);
  await s.from("audit_events").insert({
    pool_id: pool.id,
    event_type:
      waitlistedShares > 0
        ? "participant_waitlisted"
        : "participant_self_joined",
    entity_type: "participant",
    entity_id: participant.participant_id,
    details: {
      source: "public_pool_link",
      requested_shares: shares,
      confirmed_shares: confirmedShares,
      waitlisted_shares: waitlistedShares,
      waitlist_position: participant.waitlist_position ?? null,
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(
    participantAccessCookieName(slug),
    String(participant.access_token),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    },
  );
  redirect(
    `/p/${participant.access_token}?joined=1${waitlistedShares > 0 ? `&waitlist=${participant.waitlist_position}&confirmedShares=${confirmedShares}&waitlistedShares=${waitlistedShares}` : ""}`,
  );
}
export default async function JoinPool({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const s = createAdminClient();
  const { data: pool } = await s
    .from("pools")
    .select(
      "id,title,lottery,total_shares,share_price_cents,payment_deadline,status,rules_text,rules_version",
    )
    .eq("public_slug", slug)
    .maybeSingle();
  if (!pool)
    return (
      <main className="shell">
        <section className="section">
          <h1>Bolão não encontrado</h1>
        </section>
      </main>
    );
  const { data: participants } = await s
    .from("participants")
    .select("shares,status")
    .eq("pool_id", pool.id);
  const used = (participants ?? [])
      .filter((p) => p.status === "confirmed")
      .reduce((sum, p) => sum + (Number(p.shares) || 0), 0),
    available = Math.max(0, Number(pool.total_shares) - used),
    deadlinePassed = new Date(pool.payment_deadline).getTime() < Date.now(),
    canRegister = pool.status === "open" && !deadlinePassed,
    isWaitlist = available < 1,
    confirmWaitlist = q.confirmWaitlist === "1",
    requested = Math.max(1, Math.min(2, Number(q.shares || 1))),
    guaranteed = Math.min(
      requested,
      Math.max(0, Number(q.remaining ?? available)),
    ),
    waiting = Math.max(0, requested - guaranteed);
  return (
    <main className="shell">
      <Link className="back" href={`/bolao/${slug}`}>
        ← Voltar ao bolão
      </Link>
      <section className="section">
        <p className="eyebrow">PARTICIPAR DO BOLÃO</p>
        <h1>🍀 {pool.title}</h1>
        <p className="muted">
          {pool.lottery} ·{" "}
          {available > 0
            ? `${available} vaga(s) disponível(is)`
            : "Vagas preenchidas · lista de espera aberta"}
        </p>
      </section>
      <section className="section">
        {!canRegister ? (
          <>
            <h2>Inscrições encerradas</h2>
            <p className="muted">
              Este bolão não aceita novos cadastros neste momento.
            </p>
          </>
        ) : confirmWaitlist ? (
          <>
            <h2>⏳ Lista de espera</h2>
            <p>
              <strong>
                {guaranteed > 0
                  ? `Você pode garantir ${guaranteed} cota(s) agora.`
                  : "As cotas principais já foram preenchidas."}
              </strong>
            </p>
            <p className="muted">
              {waiting > 0
                ? `Falta(m) ${waiting} cota(s) do seu pedido. Deseja colocar somente essa parte na lista de espera? Sua posição será informada após confirmar.`
                : ""}
            </p>
            <form className="form" action={joinPool}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="name" value={q.name || ""} />
              <input type="hidden" name="phone" value={q.phone || ""} />
              <input type="hidden" name="shares" value={requested} />
              <input type="hidden" name="rules_agreed" value="on" />
              <label>
                <input type="checkbox" name="accept_waitlist" required /> Sim,
                quero colocar {waiting} cota(s) na lista de espera.
              </label>
              <button className="button primary">
                CONFIRMAR E ENTRAR NA FILA
              </button>
              <Link
                className="button secondary"
                href={`/bolao/${slug}/entrar?name=${encodeURIComponent(q.name || "")}&phone=${encodeURIComponent(q.phone || "")}&shares=${guaranteed || 1}&onlyAvailable=1`}
              >
                {guaranteed > 0
                  ? `FICAR SOMENTE COM ${guaranteed} COTA(S)`
                  : "NÃO ENTRAR NA FILA"}
              </Link>
            </form>
          </>
        ) : (
          <>
            <h2>
              {isWaitlist
                ? "Entrar na lista de espera"
                : "Crie seu cadastro de participante"}
            </h2>
            <p className="muted">
              {isWaitlist
                ? "As vagas principais estão preenchidas. Você pode entrar na fila por ordem de inscrição e só paga se ganhar uma vaga."
                : "Cada participante pode adquirir no máximo 2 cotas no mesmo cadastro."}
            </p>
            <JoinPoolForm
              action={joinPool}
              slug={slug}
              rules={pool.rules_text || DEFAULT_POOL_RULES}
              defaultName={q.name}
              defaultPhone={q.phone}
              defaultShares={q.shares}
              isWaitlist={isWaitlist}
            />
          </>
        )}
      </section>
    </main>
  );
}
