"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
type PaymentMethod = "pix" | "cash" | "other";
const phoneKey = (v: string) => v.replace(/\D/g, "");
export async function confirmPayment(input: {
  poolId: string;
  participantId: string;
  amountCents: number;
  shares: number;
  method?: PaymentMethod;
  receiptPath?: string;
}) {
  const shares = Number(input.shares),
    method: PaymentMethod =
      input.method === "cash" || input.method === "other"
        ? input.method
        : "pix";
  if (
    !input.poolId ||
    !input.participantId ||
    !Number.isInteger(shares) ||
    shares <= 0
  )
    throw new Error("Pagamento inválido.");
  const s = await createClient(),
    { data: a } = await s.auth.getUser();
  if (!a.user) throw new Error("Faça login para continuar.");
  const { data: pool } = await s
    .from("pools")
    .select("owner_id,share_price_cents")
    .eq("id", input.poolId)
    .single();
  if (!pool || pool.owner_id !== a.user.id)
    throw new Error("Somente o organizador pode confirmar pagamentos.");
  const { data: p } = await s
    .from("participants")
    .select("id,name,phone,shares,payment_status,status")
    .eq("id", input.participantId)
    .eq("pool_id", input.poolId)
    .single();
  if (!p || p.status === "cancelled")
    throw new Error("Participante não encontrado.");
  if (p.payment_status === "confirmed")
    throw new Error("Este pagamento já foi confirmado.");
  if (shares !== Number(p.shares))
    throw new Error("A quantidade de cotas mudou. Atualize a página.");
  const { data: autoCheckout } = await s
    .from("payment_checkout_sessions")
    .select("id")
    .eq("participant_id", p.id)
    .in("status", ["creating", "pending", "processing", "review_required"])
    .limit(1)
    .maybeSingle();
  if (autoCheckout)
    throw new Error(
      "Existe uma cobrança automática ativa para este participante. Aguarde o retorno antes de confirmar manualmente.",
    );
  const gross = Number(p.shares) * Number(pool.share_price_cents),
    { data: previous } = await s
      .from("payments")
      .select("amount_cents,credit_used_cents")
      .eq("participant_id", p.id)
      .in("status", ["partial", "confirmed"]),
    alreadyPaid = (previous ?? []).reduce(
      (sum, row) =>
        sum +
        Number(row.amount_cents || 0) +
        Number(row.credit_used_cents || 0),
      0,
    ),
    remaining = Math.max(0, gross - alreadyPaid);
  if (remaining <= 0)
    throw new Error("Esta cota já está quitada. Atualize a página.");
  const requested = method === "cash" ? Number(input.amountCents) : remaining;
  if (!Number.isInteger(requested) || requested <= 0)
    throw new Error("Informe um valor recebido maior que zero.");
  if (requested > remaining)
    throw new Error("O valor informado é maior que o saldo restante da cota.");
  const phone = phoneKey(p.phone || "");
  let account: any = null;
  if (phone) {
    const { data } = await s
      .from("participant_credit_accounts")
      .select("id,balance_cents")
      .eq("owner_id", a.user.id)
      .eq("phone", phone)
      .maybeSingle();
    account = data;
  }
  const creditUsed =
      method === "cash"
        ? 0
        : Math.min(remaining, Number(account?.balance_cents || 0)),
    cashPaid = method === "cash" ? requested : remaining - creditUsed,
    totalAfter = alreadyPaid + cashPaid + creditUsed,
    finalPayment = totalAfter >= gross,
    paymentStatus = finalPayment ? "confirmed" : "partial";
  const { data: sub } = await s
      .from("payment_submissions")
      .select("id,receipt_path")
      .eq("participant_id", p.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    receipt = input.receiptPath?.trim() || sub?.receipt_path || null,
    now = new Date().toISOString();
  const { data: payment, error: pe } = await s
    .from("payments")
    .insert({
      pool_id: input.poolId,
      participant_id: p.id,
      amount_cents: cashPaid,
      gross_amount_cents: gross,
      credit_used_cents: creditUsed,
      status: paymentStatus,
      payment_method: cashPaid ? method : "other",
      receipt_path: receipt,
      submitted_at: sub ? now : null,
      confirmed_at: now,
    })
    .select()
    .single();
  if (pe) throw new Error(pe.message);
  try {
    if (account && creditUsed) {
      const balance = Number(account.balance_cents),
        remainingCredit = balance - creditUsed;
      const { error: u } = await s
        .from("participant_credit_accounts")
        .update({ balance_cents: remainingCredit, updated_at: now })
        .eq("id", account.id)
        .eq("balance_cents", balance);
      if (u) throw u;
      const { error: l } = await s
        .from("participant_credit_ledger")
        .insert({
          account_id: account.id,
          pool_id: input.poolId,
          participant_id: p.id,
          amount_cents: -creditUsed,
          kind: "use",
          description: `Crédito utilizado no bolão por ${p.name}`,
          created_by: a.user.id,
        });
      if (l) throw l;
    }
    const label =
      method === "cash"
        ? "dinheiro"
        : method === "other"
          ? "outro meio"
          : "Pix";
    if (cashPaid) {
      const { error: w } = await s
        .from("wallet_transactions")
        .insert({
          pool_id: input.poolId,
          payment_id: payment.id,
          type: "payment_confirmed",
          amount_cents: cashPaid,
          shares: finalPayment ? Number(p.shares) : 0,
          description: finalPayment
            ? `Pagamento quitado via ${label}`
            : `Pagamento parcial em dinheiro de ${p.name}`,
          created_by: a.user.id,
        });
      if (w) throw w;
    }
    if (creditUsed) {
      const { error: w } = await s
        .from("wallet_transactions")
        .insert({
          pool_id: input.poolId,
          payment_id: payment.id,
          type: "credit_used",
          amount_cents: creditUsed,
          shares: 0,
          description: `Crédito abatido de ${p.name}`,
          created_by: a.user.id,
        });
      if (w) throw w;
    }
    const { error: ue } = await s
      .from("participants")
      .update({ payment_status: paymentStatus })
      .eq("id", p.id)
      .in("payment_status", ["pending", "partial"]);
    if (ue) throw ue;
  } catch (error) {
    await s.from("wallet_transactions").delete().eq("payment_id", payment.id);
    await s
      .from("participant_credit_ledger")
      .delete()
      .eq("pool_id", input.poolId)
      .eq("participant_id", p.id)
      .eq("kind", "use");
    if (account && creditUsed)
      await s
        .from("participant_credit_accounts")
        .update({ balance_cents: account.balance_cents })
        .eq("id", account.id);
    await s.from("payments").delete().eq("id", payment.id);
    throw error;
  }
  if (sub && finalPayment)
    await s
      .from("payment_submissions")
      .update({ status: "approved", reviewed_at: now })
      .eq("id", sub.id);
  await s
    .from("audit_events")
    .insert({
      pool_id: input.poolId,
      actor_id: a.user.id,
      event_type: finalPayment ? "payment_confirmed" : "payment_partial",
      entity_type: "payment",
      entity_id: payment.id,
      details: {
        participant_id: p.id,
        participant_name: p.name,
        gross_amount_cents: gross,
        amount_received_cents: cashPaid,
        credit_used_cents: creditUsed,
        paid_total_cents: totalAfter,
        remaining_cents: Math.max(0, gross - totalAfter),
        shares: Number(p.shares),
        method,
      },
    });
  revalidatePath("/");
  revalidatePath("/carteira");
  revalidatePath("/carteira/creditos");
  revalidatePath("/participantes");
  return payment;
}
export async function confirmParticipantPaymentForm(formData: FormData) {
  const poolId = String(formData.get("poolId") ?? ""),
    raw = String(formData.get("receivedAmount") ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
    method = String(formData.get("method") ?? "pix") as PaymentMethod,
    amountCents =
      method === "cash"
        ? Math.round(Number(raw) * 100)
        : Number(formData.get("remainingCents") ?? 0);
  await confirmPayment({
    poolId,
    participantId: String(formData.get("participantId") ?? ""),
    shares: Number(formData.get("shares")),
    amountCents,
    method,
  });
  redirect(`/participantes?pool=${poolId}`);
}
