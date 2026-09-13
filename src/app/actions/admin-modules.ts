"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseMoneyToCents, splitPrize } from "@/lib/admin-finance";
const digits = (v: string) => v.replace(/\D/g, "");
async function owner(poolId: string) {
  const s = await createClient(),
    { data: a } = await s.auth.getUser();
  if (!a.user) throw new Error("Faça login.");
  const { data: p } = await s
    .from("pools")
    .select("id,owner_id,total_shares")
    .eq("id", poolId)
    .maybeSingle();
  if (!p || p.owner_id !== a.user.id) throw new Error("Bolão não autorizado.");
  return { s, user: a.user, pool: p };
}
export async function editParticipant(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    id = String(form.get("participantId") || ""),
    name = String(form.get("name") || "").trim(),
    phone = digits(String(form.get("phone") || "")),
    shares = Number(form.get("shares"));
  if (name.length < 2) throw new Error("Informe o nome.");
  if (phone.length < 10 || phone.length > 13)
    throw new Error("WhatsApp inválido.");
  if (!Number.isInteger(shares) || shares < 1 || shares > 2)
    throw new Error("Use 1 ou 2 cotas.");
  const { s, user } = await owner(poolId);
  const { data: old } = await s
    .from("participants")
    .select("name,phone,shares,payment_status")
    .eq("id", id)
    .eq("pool_id", poolId)
    .single();
  if (!old) throw new Error("Participante não encontrado.");
  if (old.payment_status === "confirmed" && shares !== Number(old.shares))
    throw new Error("Não altere cotas de uma participação paga.");
  const { error } = await s
    .from("participants")
    .update({ name, phone, shares })
    .eq("id", id)
    .eq("pool_id", poolId);
  if (error) throw error;
  await s.from("audit_events").insert({
    pool_id: poolId,
    actor_id: user.id,
    event_type: "participant_edited",
    entity_type: "participant",
    entity_id: id,
    details: { before: old, after: { name, phone, shares } },
  });
  revalidatePath("/participantes");
}
export async function reactivateParticipant(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    id = String(form.get("participantId") || "");
  const { s, user } = await owner(poolId);
  const { error } = await s
    .from("participants")
    .update({ status: "confirmed" })
    .eq("id", id)
    .eq("pool_id", poolId)
    .eq("status", "cancelled");
  if (error) throw error;
  await s.from("audit_events").insert({
    pool_id: poolId,
    actor_id: user.id,
    event_type: "participant_reactivated",
    entity_type: "participant",
    entity_id: id,
  });
  revalidatePath("/participantes");
}
export async function saveLegalDocument(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    kind = String(form.get("kind") || ""),
    title = String(form.get("title") || "").trim(),
    content = String(form.get("content") || "").trim();
  if (
    !["privacy", "terms", "lgpd"].includes(kind) ||
    title.length < 3 ||
    content.length < 20
  )
    throw new Error("Documento incompleto.");
  const { s, user } = await owner(poolId);
  const { data: old } = await s
    .from("legal_documents")
    .select("version")
    .eq("owner_id", user.id)
    .eq("kind", kind)
    .maybeSingle();
  const { error } = await s.from("legal_documents").upsert(
    {
      owner_id: user.id,
      kind,
      title,
      content,
      version: Number(old?.version || 0) + 1,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,kind" },
  );
  if (error) throw error;
  revalidatePath("/menu/documentos-legais");
}

async function recalculateParticipant(
  s: any,
  participantId: string,
  poolId: string,
  gross: number,
) {
  const { data: rows } = await s
    .from("payments")
    .select("amount_cents,credit_used_cents,status")
    .eq("participant_id", participantId)
    .in("status", ["partial", "confirmed"]);
  const total = (rows ?? []).reduce(
      (n: number, r: any) =>
        n + Number(r.amount_cents || 0) + Number(r.credit_used_cents || 0),
      0,
    ),
    status = total >= gross ? "confirmed" : total > 0 ? "partial" : "pending";
  await s
    .from("participants")
    .update({ payment_status: status })
    .eq("id", participantId)
    .eq("pool_id", poolId);
}

export async function correctPayment(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    paymentId = String(form.get("paymentId") || ""),
    reason = String(form.get("reason") || "").trim(),
    newAmount = Math.round(
      Number(String(form.get("newAmount") || "0").replace(",", ".")) * 100,
    );
  if (reason.length < 3 || !Number.isInteger(newAmount) || newAmount < 0)
    throw new Error("Informe o novo valor e o motivo.");
  const { s, user } = await owner(poolId);
  const { data: p } = await s
    .from("payments")
    .select(
      "participant_id,amount_cents,credit_used_cents,gross_amount_cents,status",
    )
    .eq("id", paymentId)
    .eq("pool_id", poolId)
    .single();
  if (!p || p.status === "cancelled")
    throw new Error("Pagamento não encontrado.");
  if (Number(p.credit_used_cents || 0) > 0)
    throw new Error("Pagamento com crédito exige estorno assistido.");
  const old = Number(p.amount_cents);
  const { error } = await s
    .from("payments")
    .update({ amount_cents: newAmount, status: "partial" })
    .eq("id", paymentId);
  if (error) throw error;
  await s
    .from("wallet_transactions")
    .update({
      amount_cents: newAmount,
      description: `Pagamento corrigido: ${reason}`,
    })
    .eq("payment_id", paymentId)
    .eq("type", "payment_confirmed");
  await s.from("payment_adjustments").insert({
    pool_id: poolId,
    payment_id: paymentId,
    participant_id: p.participant_id,
    kind: "amount_correction",
    previous_amount_cents: old,
    new_amount_cents: newAmount,
    reason,
    created_by: user.id,
  });
  await recalculateParticipant(
    s,
    p.participant_id,
    poolId,
    Number(p.gross_amount_cents || 0),
  );
  revalidatePath("/menu/corrigir-parcela");
  revalidatePath("/participantes");
  revalidatePath("/carteira");
}

export async function reversePayment(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    paymentId = String(form.get("paymentId") || ""),
    reason = String(form.get("reason") || "").trim();
  if (reason.length < 3) throw new Error("Informe o motivo do estorno.");
  const { s, user } = await owner(poolId);
  const { data: p } = await s
    .from("payments")
    .select(
      "participant_id,amount_cents,credit_used_cents,gross_amount_cents,status",
    )
    .eq("id", paymentId)
    .eq("pool_id", poolId)
    .single();
  if (!p || p.status === "cancelled")
    throw new Error("Pagamento não encontrado.");
  if (Number(p.credit_used_cents || 0) > 0)
    throw new Error("Pagamento com crédito exige estorno assistido.");
  const old = Number(p.amount_cents);
  await s.from("payments").update({ status: "cancelled" }).eq("id", paymentId);
  await s
    .from("wallet_transactions")
    .update({ amount_cents: 0, description: `Pagamento estornado: ${reason}` })
    .eq("payment_id", paymentId)
    .eq("type", "payment_confirmed");
  await s.from("payment_adjustments").insert({
    pool_id: poolId,
    payment_id: paymentId,
    participant_id: p.participant_id,
    kind: "reversal",
    previous_amount_cents: old,
    new_amount_cents: 0,
    reason,
    created_by: user.id,
  });
  await recalculateParticipant(
    s,
    p.participant_id,
    poolId,
    Number(p.gross_amount_cents || 0),
  );
  revalidatePath("/menu/estornar-pagamento");
  revalidatePath("/participantes");
  revalidatePath("/carteira");
}

export async function createPrizeDistribution(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    description = String(form.get("description") || "").trim(),
    amount = parseMoneyToCents(String(form.get("amount") || "0"));
  if (!Number.isInteger(amount) || amount <= 0)
    throw new Error("Informe o valor do prêmio.");
  const { s, user } = await owner(poolId);
  const { data: parts } = await s
    .from("participants")
    .select("id,shares")
    .eq("pool_id", poolId)
    .eq("status", "confirmed")
    .eq("payment_status", "confirmed")
    .eq("is_test", false);
  const total = (parts ?? []).reduce(
    (n: number, p: any) => n + Number(p.shares),
    0,
  );
  if (!total) throw new Error("Não existem cotas pagas para dividir.");
  const { data: event, error } = await s
    .from("prize_events")
    .insert({
      pool_id: poolId,
      gross_amount_cents: amount,
      description: description || "Prêmio do bolão",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  const allocations = splitPrize(amount, parts ?? []).map(
    ({ participant: p, amountCents: value }) => ({
      prize_event_id: event.id,
      pool_id: poolId,
      participant_id: p.id,
      shares: Number(p.shares),
      amount_cents: value,
    }),
  );
  const { error: a } = await s.from("prize_allocations").insert(allocations);
  if (a) throw a;
  await s
    .from("prize_events")
    .update({ status: "distributed", distributed_at: new Date().toISOString() })
    .eq("id", event.id);
  revalidatePath("/menu/distribuir-premios");
}

export async function creditPrize(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    allocationId = String(form.get("allocationId") || "");
  const { s, user } = await owner(poolId);
  const { data: allocation } = await s
    .from("prize_allocations")
    .select(
      "id,participant_id,amount_cents,destination,participants(name,phone)",
    )
    .eq("id", allocationId)
    .eq("pool_id", poolId)
    .single();
  if (!allocation || allocation.destination !== "pending")
    throw new Error("Prêmio indisponível.");
  const participant = allocation.participants as any;
  const phone = digits(String(participant?.phone || ""));
  if (!phone)
    throw new Error("O participante precisa ter WhatsApp cadastrado.");
  let { data: account } = await s
    .from("participant_credit_accounts")
    .select("id,balance_cents")
    .eq("owner_id", user.id)
    .eq("phone", phone)
    .maybeSingle();
  if (!account) {
    const created = await s
      .from("participant_credit_accounts")
      .insert({ owner_id: user.id, phone, balance_cents: 0 })
      .select("id,balance_cents")
      .single();
    if (created.error) throw created.error;
    account = created.data;
  }
  const amount = Number(allocation.amount_cents);
  const { error: updateError } = await s
    .from("participant_credit_accounts")
    .update({
      balance_cents: Number(account.balance_cents) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id)
    .eq("balance_cents", account.balance_cents);
  if (updateError) throw updateError;
  const { error: ledgerError } = await s
    .from("participant_credit_ledger")
    .insert({
      account_id: account.id,
      pool_id: poolId,
      participant_id: allocation.participant_id,
      amount_cents: amount,
      kind: "prize",
      description: `Prêmio convertido em crédito para ${participant.name}`,
      created_by: user.id,
    });
  if (ledgerError) throw ledgerError;
  await s
    .from("prize_allocations")
    .update({ destination: "credit", paid_at: new Date().toISOString() })
    .eq("id", allocationId)
    .eq("destination", "pending");
  await s.from("audit_events").insert({
    pool_id: poolId,
    actor_id: user.id,
    event_type: "prize_credited",
    entity_type: "prize_allocation",
    entity_id: allocationId,
    details: {
      participant_id: allocation.participant_id,
      amount_cents: amount,
    },
  });
  revalidatePath("/menu/creditar-premio");
  revalidatePath("/carteira/creditos");
}

export async function markPrizePixPaid(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    allocationId = String(form.get("allocationId") || "");
  const { s, user } = await owner(poolId);
  const { data } = await s
    .from("prize_allocations")
    .update({ destination: "pix", paid_at: new Date().toISOString() })
    .eq("id", allocationId)
    .eq("pool_id", poolId)
    .eq("destination", "pending")
    .select("participant_id,amount_cents")
    .maybeSingle();
  if (!data) throw new Error("Prêmio indisponível ou já finalizado.");
  await s.from("audit_events").insert({
    pool_id: poolId,
    actor_id: user.id,
    event_type: "prize_pix_paid",
    entity_type: "prize_allocation",
    entity_id: allocationId,
    details: data,
  });
  revalidatePath("/menu/creditar-premio");
}

export async function resolveAppError(form: FormData) {
  const poolId = String(form.get("poolId") || ""),
    errorId = String(form.get("errorId") || "");
  const { s, user } = await owner(poolId);
  const { error } = await s
    .from("app_error_logs")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("id", errorId)
    .or(`pool_id.eq.${poolId},pool_id.is.null`)
    .is("resolved_at", null);
  if (error) throw error;
  revalidatePath("/menu/painel-erros");
}
