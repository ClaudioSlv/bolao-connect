import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReminderOptIn } from "@/components/reminder-opt-in";
import { ReservationConfirmedModal } from "@/components/reservation-confirmed-modal";
import { PagBankCheckout } from "@/components/pagbank-checkout";
import { ManualPixCopy } from "@/components/manual-pix-copy";
import { ParticipantActionGrid } from "@/components/participant-action-grid";
import { AvailablePoolsNotice } from "@/components/available-pools-notice";
import { RulesAcceptanceForm } from "@/components/rules-acceptance-form";
import {
  DEFAULT_POOL_RULES,
  DEFAULT_POOL_RULES_VERSION,
} from "@/lib/pool-rules";
export const dynamic = "force-dynamic";
const money = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    c / 100,
  );
const phoneKey = (v: string) => v.replace(/\D/g, "");
async function acceptRules(f: FormData) {
  "use server";
  const token = String(f.get("token") ?? "");
  if (f.get("agreed") !== "on")
    throw new Error("É necessário aceitar as Regras do Bolão.");
  const s = createAdminClient();
  const { data: p } = await s
    .from("participants")
    .select("id,pool_id,status")
    .eq("access_token", token)
    .maybeSingle();
  if (!p || p.status === "cancelled") throw new Error("Participante inválido.");
  const { data: pool } = await s
    .from("pools")
    .select("rules_text,rules_version")
    .eq("id", p.pool_id)
    .maybeSingle();
  const text = pool?.rules_text || DEFAULT_POOL_RULES,
    version = Number(pool?.rules_version || DEFAULT_POOL_RULES_VERSION);
  const { error } = await s.from("pool_rule_acceptances").upsert(
    {
      pool_id: p.pool_id,
      participant_id: p.id,
      rules_version: version,
      rules_text: text,
    },
    { onConflict: "pool_id,participant_id,rules_version" },
  );
  if (error) throw error;
  redirect(`/p/${token}?rules=accepted`);
}
async function submitReceipt(f: FormData) {
  "use server";
  const token = String(f.get("token") ?? ""),
    file = f.get("receipt");
  if (!(file instanceof File) || file.size < 1)
    throw new Error("Selecione o comprovante.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("O arquivo deve ter no máximo 5 MB.");
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type))
    throw new Error("Envie JPG, PNG, WebP ou PDF.");
  const s = createAdminClient();
  const { data: p } = await s
    .from("participants")
    .select("id,pool_id,status,payment_status")
    .eq("access_token", token)
    .maybeSingle();
  if (!p || p.status !== "confirmed" || p.payment_status === "confirmed")
    throw new Error("Este pagamento não aceita novo comprovante.");
  const { data: pool } = await s
    .from("pools")
    .select("rules_version,payment_opens_at,payment_deadline")
    .eq("id", p.pool_id)
    .maybeSingle();
  const now = Date.now(),
    opens = pool?.payment_opens_at
      ? new Date(pool.payment_opens_at).getTime()
      : 0,
    closes = pool?.payment_deadline
      ? new Date(pool.payment_deadline).getTime()
      : 0;
  if (opens && now < opens)
    throw new Error("Os pagamentos deste bolão ainda não foram abertos.");
  if (closes && now > closes)
    throw new Error("O prazo de pagamento deste bolão foi encerrado.");
  const version = Number(pool?.rules_version || DEFAULT_POOL_RULES_VERSION);
  const { data: acceptance } = await s
    .from("pool_rule_acceptances")
    .select("id")
    .eq("participant_id", p.id)
    .eq("pool_id", p.pool_id)
    .eq("rules_version", version)
    .maybeSingle();
  if (!acceptance)
    throw new Error("Aceite as Regras do Bolão antes de enviar o pagamento.");
  const ext =
      file.type === "application/pdf"
        ? "pdf"
        : file.type.split("/")[1].replace("jpeg", "jpg"),
    path = `${p.pool_id}/${p.id}/${crypto.randomUUID()}.${ext}`;
  const { error: u } = await s.storage
    .from("payment-receipts")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (u) throw u;
  await s
    .from("payment_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("participant_id", p.id)
    .eq("status", "pending");
  const { error } = await s.from("payment_submissions").insert({
    pool_id: p.pool_id,
    participant_id: p.id,
    receipt_path: path,
    status: "pending",
  });
  if (error) throw error;
  redirect(`/p/${token}?sent=1`);
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string; rules?: string }>;
}) {
  const { token } = await params;
  const { sent, rules: rulesStatus } = await searchParams;
  let data: any = null;
  try {
    const s = createAdminClient();
    const { data: p } = await s
      .from("participants")
      .select(
        "id,pool_id,name,phone,shares,status,payment_status,is_test,test_amount_cents,payment_deadline_override",
      )
      .eq("access_token", token)
      .maybeSingle();
    if (p) {
      const { data: pool } = await s
        .from("pools")
        .select(
          "owner_id,title,lottery,share_price_cents,payment_opens_at,payment_deadline,waitlist_payment_deadline,public_slug,rules_text,rules_version",
        )
        .eq("id", p.pool_id)
        .maybeSingle();
      const { data: sub } = await s
        .from("payment_submissions")
        .select("status,created_at")
        .eq("participant_id", p.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = Number(pool?.rules_version || DEFAULT_POOL_RULES_VERSION);
      const { data: acceptance } = await s
        .from("pool_rule_acceptances")
        .select("accepted_at")
        .eq("participant_id", p.id)
        .eq("pool_id", p.pool_id)
        .eq("rules_version", version)
        .maybeSingle();
      let credit = 0;
      if (!p.is_test && pool?.owner_id && p.phone) {
        const { data: account } = await s
          .from("participant_credit_accounts")
          .select("balance_cents")
          .eq("owner_id", pool.owner_id)
          .eq("phone", phoneKey(p.phone))
          .maybeSingle();
        credit = Number(account?.balance_cents || 0);
      }
      let availablePools: any[] = [];
      if (pool?.owner_id && p.phone) {
        const normalizedPhone = phoneKey(p.phone);
        const { data: memberships } = await s
          .from("participants")
          .select("pool_id")
          .eq("phone", normalizedPhone)
          .neq("status", "cancelled");
        const joined = new Set((memberships ?? []).map((item) => item.pool_id));
        const { data: openPools } = await s
          .from("pools")
          .select("id,lottery,public_slug")
          .eq("owner_id", pool.owner_id)
          .eq("status", "open")
          .gt("payment_deadline", new Date().toISOString())
          .order("created_at", { ascending: false });
        availablePools = (openPools ?? []).filter(
          (item) => item.public_slug && !joined.has(item.id),
        );
      }
      data = { p, pool, sub, acceptance, credit, availablePools };
    }
  } catch {}
  if (!data?.p || !data?.pool)
    return (
      <main className="shell">
        <section className="section">
          <h1>Link inválido</h1>
        </section>
      </main>
    );
  const { p, pool, sub, acceptance, credit, availablePools } = data,
    isTest = Boolean(p.is_test),
    amount = isTest
      ? Number(p.test_amount_cents || 100)
      : Number(p.shares) * Number(pool.share_price_cents),
    applied = Math.min(amount, credit),
    due = Math.max(0, amount - applied),
    remaining = Math.max(0, credit - amount),
    paid = p.payment_status === "confirmed",
    rules = pool.rules_text || DEFAULT_POOL_RULES;
  const now = Date.now(),
    opens = pool.payment_opens_at
      ? new Date(pool.payment_opens_at).getTime()
      : 0,
    closes = p.payment_deadline_override
      ? new Date(p.payment_deadline_override).getTime()
      : pool.payment_deadline
        ? new Date(pool.payment_deadline).getTime()
        : 0,
    paymentOpen =
      isTest || ((!opens || now >= opens) && (!closes || now <= closes)),
    paymentNotStarted = !isTest && Boolean(opens && now < opens),
    paymentClosed = !isTest && Boolean(closes && now > closes),
    isWaitlisted = p.status === "waitlisted",
    isExpired = p.status === "expired";
  return (
    <main className="shell">
      <ReservationConfirmedModal
        token={token}
        accepted={Boolean(acceptance)}
        justAccepted={rulesStatus === "accepted"}
      />
      <AvailablePoolsNotice
        pools={availablePools}
        participant={{ token, name: p.name, phone: p.phone }}
      />
      <section className="section">
        <p className="eyebrow">
          {isTest ? "PARTICIPAR DO BOLÃO · MODO TESTE" : "BOLÃO AMIGOS BTP"}
        </p>
        <h1>🍀 {pool.title}</h1>
        <p>
          <strong>{p.name}</strong> ·{" "}
          {isTest
            ? "Teste de pagamento · não ocupa cota"
            : `${p.shares} cota(s)`}
        </p>
        <div className="card">
          <div className="wallet-row">
            <span>
              {isTest ? "Valor do teste InfinitePay" : "Valor da participação"}
            </span>
            <strong>{money(amount)}</strong>
          </div>
          {applied > 0 && (
            <div className="wallet-row">
              <span>💳 Crédito aplicado</span>
              <strong>- {money(applied)}</strong>
            </div>
          )}
          <div className="wallet-row">
            <span>🟢 VALOR A PAGAR</span>
            <strong>{paid ? money(0) : money(due)}</strong>
          </div>
          {remaining > 0 && (
            <div className="wallet-row">
              <span>Crédito restante</span>
              <strong>{money(remaining)}</strong>
            </div>
          )}
        </div>
        {paid ? (
          <p className="status">
            ✅ SUA COTA JÁ ESTÁ QUITADA. Você não tem nenhuma cota pendente para
            pagar.
          </p>
        ) : (
          applied > 0 && (
            <p className="status">
              Seu crédito foi aplicado automaticamente. Faça o Pix somente do
              valor indicado acima.
            </p>
          )
        )}
        <p className="muted">
          Abertura dos pagamentos:{" "}
          {pool.payment_opens_at
            ? new Date(pool.payment_opens_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })
            : "disponível"}
        </p>
        <p className="muted">
          Encerramento:{" "}
          {new Date(p.payment_deadline_override || pool.payment_deadline).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </p>
      </section>
      {acceptance && <ReminderOptIn token={token} paid={paid} />}
      <section className="section">
        <h2>📜 Regras do Bolão</h2>
        {acceptance ? (
          <p className="status">
            ✓ Regras aceitas em{" "}
            {new Date(acceptance.accepted_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        ) : (
          <>
            <div className="rules-required-notice">
              <strong>⚠️ LEITURA OBRIGATÓRIA</strong>
              <span>
                Para continuar, abra as regras do grupo, leia e confirme que
                está de acordo.
              </span>
            </div>
            <details className="rules-disclosure">
              <summary>📜 ABRIR E LER AS REGRAS DO GRUPO</summary>
              <div className="card">
                <span style={{ whiteSpace: "pre-line" }}>{rules}</span>
              </div>
              <RulesAcceptanceForm token={token} action={acceptRules} />
            </details>
          </>
        )}
      </section>
      {acceptance && paid && (
        <section className="section">
          <h2>✅ Cota quitada</h2>
          <p className="status">PAGAMENTO CONFIRMADO</p>
          <p className="muted">
            Sua cota já está paga. Não há nenhum pagamento pendente para esta
            participação.
          </p>
        </section>
      )}
      {acceptance && !paid && isExpired && (
        <section className="section">
          <h2>🔴 Prazo de pagamento encerrado</h2>
          <p className="muted">Sua reserva não foi paga dentro do prazo e a cota foi disponibilizada para a lista de espera.</p>
          <p className="status">O pagamento desta reserva não está mais disponível.</p>
        </section>
      )}
      {acceptance && !paid && isWaitlisted && (
        <section className="section">
          <h2>⏳ Lista de espera</h2>
          <p className="muted">
            Você está na lista de espera. Não faça pagamento agora. O pagamento
            será liberado somente se você ganhar uma vaga.
          </p>
        </section>
      )}
      {acceptance && !paid && !isWaitlisted && !isExpired && paymentNotStarted && (
        <section className="section">
          <h2>🔒 Pagamento ainda fechado</h2>
          <p className="muted">
            Você ainda não precisa pagar. Os pagamentos serão liberados
            automaticamente em{" "}
            <strong>
              {new Date(pool.payment_opens_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </strong>
            .
          </p>
          <Link
            className="button secondary"
            href={`/temporizador/${pool.public_slug}`}
          >
            Ver temporizador
          </Link>
        </section>
      )}
      {acceptance && !paid && !isWaitlisted && !isExpired && paymentClosed && (
        <section className="section">
          <h2>🔴 Pagamentos encerrados</h2>
          <p className="muted">
            O prazo para enviar um novo comprovante terminou. Fale com o
            organizador se precisar de ajuda.
          </p>
        </section>
      )}
      {acceptance && !paid && !isWaitlisted && !isExpired && paymentOpen && (
        <section className="section">
          <h2>Pagamento automático por Pix</h2>
          <div className="card">
            <strong>Valor do Pix: {money(due)}</strong>
            <span>Pagamento seguro pelo PagBank</span>
            <span>
              O QR Code será vinculado automaticamente ao seu cadastro.
            </span>
          </div>
          {due === 0 ? (
            <p className="status">
              ✓ Sua participação foi totalmente coberta pelo crédito. Não faça
              Pix.
            </p>
          ) : (
            <>
              <p className="muted">
                Gere sua cobrança individual. Assim que o PagBank confirmar o
                Pix, sua cota mudará automaticamente para <strong>Pago</strong>.
              </p>
              <PagBankCheckout
                token={token}
                amountLabel={money(due)}
                isTest={isTest}
                requiresCustomerData={
                  process.env.PAGBANK_ENVIRONMENT?.trim().toLowerCase() ===
                  "production"
                }
              />
              <ManualPixCopy
                pixKey="97a2d669-3ce8-4b7a-b571-0403f2c0aa6d"
                amountLabel={money(due)}
              />
              {sub || sent ? (
                <details className="manual-payment">
                  <summary>Já paguei por outra chave Pix</summary>
                  <p className="status">COMPROVANTE RECEBIDO</p>
                  <p className="muted">
                    Aguardando confirmação do organizador.
                  </p>
                </details>
              ) : (
                <details className="manual-payment">
                  <summary>Prefiro enviar um comprovante manual</summary>
                  <p className="muted">
                    Use esta opção somente se você pagou fora da cobrança
                    PagBank.
                  </p>
                  <form className="form" action={submitReceipt}>
                    <input type="hidden" name="token" value={token} />
                    <div className="field">
                      <label>Enviar comprovante</label>
                      <input
                        name="receipt"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        required
                      />
                    </div>
                    <button className="button secondary">
                      Enviar comprovante
                    </button>
                  </form>
                </details>
              )}
            </>
          )}
        </section>
      )}
      {acceptance && (
        <section className="section participant-area">
          <p className="eyebrow">ÁREA DO PARTICIPANTE</p>
          <h2>Acesse suas opções</h2>
          <ParticipantActionGrid token={token} poolSlug={pool.public_slug} />
        </section>
      )}
      <Link className="back" href="/">
        Bolão Amigos BTP
      </Link>
    </main>
  );
}
