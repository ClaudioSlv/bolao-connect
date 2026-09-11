import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
const normalizePhone = (value: string) => value.replace(/\D/g, "");
async function joinAsTestParticipant(form: FormData) {
  "use server";
  const testToken = String(form.get("testToken") ?? "").trim(),
    name = String(form.get("name") ?? "")
      .trim()
      .replace(/\s+/g, " "),
    phone = normalizePhone(String(form.get("phone") ?? ""));
  if (name.length < 2 || name.length > 120)
    throw new Error("Informe seu nome corretamente.");
  if (phone.length < 10 || phone.length > 13)
    throw new Error("Informe um WhatsApp válido com DDD.");
  if (form.get("confirm") !== "on")
    throw new Error("Confirme sua participação para continuar.");
  const s = createAdminClient(),
    { data: pool } = await s
      .from("pools")
      .select("id")
      .eq("test_access_token", testToken)
      .maybeSingle();
  if (!pool) throw new Error("Link de teste inválido.");
  const { data: participant, error } = await s
    .from("participants")
    .insert({
      pool_id: pool.id,
      name,
      phone,
      shares: 0,
      status: "confirmed",
      payment_status: "pending",
      is_test: true,
      test_amount_cents: 100,
      notes: "Teste de pagamento InfinitePay — não contabilizar como cota",
    })
    .select("id,access_token")
    .single();
  if (error || !participant?.access_token)
    throw new Error(
      error?.message || "Não foi possível criar o participante de teste.",
    );
  await s
    .from("audit_events")
    .insert({
      pool_id: pool.id,
      event_type: "test_participant_self_joined",
      entity_type: "participant",
      entity_id: participant.id,
      details: {
        source: "public_test_link",
        amount_cents: 100,
        provider: "infinitepay",
      },
    });
  redirect(`/p/${participant.access_token}?joined=1&test=1`);
}
export default async function TestJoin({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params,
    s = createAdminClient(),
    { data: pool } = await s
      .from("pools")
      .select("id,title,lottery")
      .eq("test_access_token", token)
      .maybeSingle();
  if (!pool)
    return (
      <main className="shell">
        <section className="section">
          <h1>Link de teste inválido</h1>
          <p className="muted">Peça ao organizador um novo link.</p>
        </section>
      </main>
    );
  return (
    <main className="shell">
      <Link className="back" href="/">
        ← Voltar
      </Link>
      <section className="section">
        <p className="eyebrow">PARTICIPAR DO BOLÃO · MODO TESTE</p>
        <h1>🍀 {pool.title}</h1>
        <p className="muted">
          {pool.lottery} · Faça o mesmo cadastro de um participante real. A
          cobrança de teste será de R$ 1,00 e não ocupará nenhuma cota.
        </p>
      </section>
      <section className="section">
        <h2>Crie seu cadastro de participante</h2>
        <form className="form" action={joinAsTestParticipant}>
          <input type="hidden" name="testToken" value={token} />
          <div className="field">
            <label>Seu nome</label>
            <input
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Nome completo"
            />
          </div>
          <div className="field">
            <label>WhatsApp com DDD</label>
            <input
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="(13) 99999-9999"
            />
          </div>
          <div className="card test-amount">
            <span>Pagamento de teste</span>
            <strong>R$ 1,00</strong>
            <span>Não ocupa cota e não entra na arrecadação.</span>
          </div>
          <label>
            <input type="checkbox" name="confirm" required /> Confirmo que
            desejo entrar como participante de teste.
          </label>
          <button className="button primary">CONFIRMAR PARTICIPAÇÃO</button>
        </form>
      </section>
    </main>
  );
}
