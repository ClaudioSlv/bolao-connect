import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReminderOptIn } from "@/components/reminder-opt-in";
import { ParticipantSelfie } from "@/components/participant-selfie";
import { InfinitePayCheckout } from "@/components/infinitepay-checkout";
import { ManualPixCopy } from "@/components/manual-pix-copy";
import {
  DEFAULT_POOL_RULES,
  DEFAULT_POOL_RULES_VERSION,
  SELFIE_CONSENT_TEXT,
  SELFIE_CONSENT_VERSION,
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
async function saveSelfie(f: FormData) {
  "use server";
  const token = String(f.get("token") ?? ""),
    file = f.get("selfie");
  if (!(file instanceof File) || file.size < 1)
    redirect(`/p/${token}?selfie=skipped`);
  if (f.get("selfieConsent") !== "on")
    throw new Error("Autorize o armazenamento da selfie para salvar a foto.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("A selfie deve ter no máximo 5 MB.");
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type))
    throw new Error("Use uma foto JPG, PNG ou WebP.");
  const s = createAdminClient();
  const { data: p } = await s
    .from("participants")
    .select("id,pool_id,status,selfie_path")
    .eq("access_token", token)
    .maybeSingle();
  if (!p || p.status === "cancelled") throw new Error("Participante inválido.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg"),
    path = `${p.pool_id}/${p.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await s.storage
    .from("participant-selfies")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await s
    .from("participants")
    .update({
      selfie_path: path,
      selfie_consent_at: new Date().toISOString(),
      selfie_consent_version: SELFIE_CONSENT_VERSION,
    })
    .eq("id", p.id);
  if (error) {
    await s.storage.from("participant-selfies").remove([path]);
    throw error;
  }
  if (p.selfie_path)
    await s.storage.from("participant-selfies").remove([p.selfie_path]);
  redirect(`/p/${token}?selfie=saved`);
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
  searchParams: Promise<{ sent?: string; selfie?: string }>;
}) {
  const { token } = await params;
  const { sent, selfie } = await searchParams;
  let data: any = null;
  try {
    const s = createAdminClient();
    const { data: p } = await s
      .from("participants")
      .select(
        "id,pool_id,name,phone,shares,status,payment_status,selfie_path,selfie_consent_at,is_test,test_amount_cents",
      )
      .eq("access_token", token)
      .maybeSingle();
    if (p) {
      const { data: pool } = await s
        .from("pools")
        .select(
          "owner_id,title,lottery,share_price_cents,payment_opens_at,payment_deadline,public_slug,rules_text,rules_version",
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
      data = { p, pool, sub, acceptance, credit };
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
  const { p, pool, sub, acceptance, credit } = data,
    isTest = Boolean(p.is_test),
    amount = isTest
      ? Number(p.test_amount_cents || 100)
      : Number(p.shares) * Number(pool.share_price_cents),
    applied = Math.min(amount, credit),
    due = Math.max(0, amount - applied),
    remaining = Math.max(0, credit - amount),
    paid = p.payment_status === "confirmed",
    rules = pool.rules_text || DEFAULT_POOL_RULES,
    selfieDone = Boolean(p.selfie_path),
    selfieSkipped = selfie === "skipped";
  const now = Date.now(),
    opens = pool.payment_opens_at
      ? new Date(pool.payment_opens_at).getTime()
      : 0,
    closes = pool.payment_deadline
      ? new Date(pool.payment_deadline).getTime()
      : 0,
    paymentOpen =
      isTest || ((!opens || now >= opens) && (!closes || now <= closes)),
    paymentNotStarted = !isTest && Boolean(opens && now < opens),
    paymentClosed = !isTest && Boolean(closes && now > closes),
    identificationComplete = selfieDone || selfieSkipped,
    isWaitlisted = p.status === "waitlisted";
  return (
    <main className="shell">
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
          {new Date(pool.payment_deadline).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </p>
      </section>
      <ReminderOptIn token={token} paid={paid} />
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
          <details className="manual-payment">
            <summary>LER REGRAS DO BOLÃO</summary>
            <div className="card">
              <span style={{ whiteSpace: "pre-line" }}>{rules}</span>
            </div>
            <form className="form" action={acceptRules}>
              <input type="hidden" name="token" value={token} />
              <label>
                <input type="checkbox" name="agreed" required /> Li e estou de
                acordo com as Regras do Bolão.
              </label>
              <button className="button primary">
                ACEITAR AS REGRAS
              </button>
            </form>
          </details>
        )}
      </section>
      {acceptance && (
        <section className="section">
          <h2>
            📷 Selfie de identificação <span className="muted">(opcional)</span>
          </h2>
          {selfieDone ? (
            <>
              <p className="status">✓ Selfie cadastrada e protegida</p>
              <p className="muted">
                A imagem fica em armazenamento privado e não é exibida aos
                demais participantes.
              </p>
            </>
          ) : selfieSkipped ? (
            <p className="muted">Você optou por continuar sem selfie.</p>
          ) : (
            <form action={saveSelfie}>
              <ParticipantSelfie
                token={token}
                consentText={SELFIE_CONSENT_TEXT}
              />
              <button className="button primary">Salvar selfie</button>
              <button className="button secondary" type="submit" formNoValidate>
                Continuar sem selfie
              </button>
            </form>
          )}
        </section>
      )}
      {acceptance && identificationComplete && paid && (
        <section className="section">
          <h2>✅ Cota quitada</h2>
          <p className="status">PAGAMENTO CONFIRMADO</p>
          <p className="muted">
            Sua cota já está paga. Não há nenhum pagamento pendente para esta
            participação.
          </p>
        </section>
      )}
      {acceptance && identificationComplete && !paid && isWaitlisted && (
        <section className="section">
          <h2>⏳ Lista de espera</h2>
          <p className="muted">
            Você está na lista de espera. Não faça pagamento agora. O pagamento
            será liberado somente se você ganhar uma vaga.
          </p>
        </section>
      )}
      {acceptance &&
        identificationComplete &&
        !paid &&
        !isWaitlisted &&
        paymentNotStarted && (
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
      {acceptance &&
        identificationComplete &&
        !paid &&
        !isWaitlisted &&
        paymentClosed && (
          <section className="section">
            <h2>🔴 Pagamentos encerrados</h2>
            <p className="muted">
              O prazo para enviar um novo comprovante terminou. Fale com o
              organizador se precisar de ajuda.
            </p>
          </section>
        )}
      {acceptance &&
        identificationComplete &&
        !paid &&
        !isWaitlisted &&
        paymentOpen && (
          <section className="section">
            <h2>Pagamento automático por Pix</h2>
            <div className="card">
              <strong>Valor do Pix: {money(due)}</strong>
              <span>Pagamento seguro pela InfinitePay</span>
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
                  Gere sua cobrança individual. Assim que a InfinitePay
                  confirmar o Pix, sua cota mudará automaticamente para{" "}
                  <strong>Pago</strong>.
                </p>
                <InfinitePayCheckout token={token} amountLabel={money(due)} />
                <ManualPixCopy pixKey="97a2d669-3ce8-4b7a-b571-0403f2c0aa6d" amountLabel={money(due)} />
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
                      InfinitePay.
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
      <section className="section">
        <h2>Comprovantes dos jogos</h2>
        <p className="muted">
          Confira as apostas registradas pelo organizador.
        </p>
        <Link className="button secondary" href={`/p/${token}/comprovantes`}>
          📷 VER COMPROVANTES
        </Link>
      </section>
      <Link className="button primary" href={`/p/${token}/carteira`}>
        💳 MINHA CARTEIRA
      </Link>
      <Link
        className="button primary"
        href={`/meu-jogo?voltar=${encodeURIComponent(`/p/${token}`)}`}
      >
        🎯 CRIAR JOGO INDIVIDUAL
      </Link>
      <Link className="button secondary" href={`/bolao/${pool.public_slug}`}>
        🏠 VOLTAR PARA O BOLÃO
      </Link>
      <Link className="back" href="/">
        Bolão Amigos BTP
      </Link>
    </main>
  );
}
