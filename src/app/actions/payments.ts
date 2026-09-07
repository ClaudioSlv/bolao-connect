"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PaymentMethod = "pix" | "cash" | "other";

export async function confirmPayment(input: { poolId: string; participantId: string; amountCents: number; shares: number; method?: PaymentMethod; receiptPath?: string }) {
  const amountCents = Number(input.amountCents);
  const shares = Number(input.shares);
  const method: PaymentMethod = input.method === "cash" || input.method === "other" ? input.method : "pix";
  const receiptPath = input.receiptPath?.trim() || null;
  if (!input.poolId || !input.participantId) throw new Error("Pagamento incompleto.");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Valor do pagamento inválido.");
  if (!Number.isInteger(shares) || shares <= 0) throw new Error("Quantidade de cotas inválida.");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login para continuar.");
  const { data: pool } = await supabase.from("pools").select("owner_id,share_price_cents").eq("id", input.poolId).single();
  if (!pool || pool.owner_id !== auth.user.id) throw new Error("Somente o organizador pode confirmar pagamentos.");
  const { data: participant } = await supabase.from("participants").select("id,name,shares,payment_status,status").eq("id", input.participantId).eq("pool_id", input.poolId).single();
  if (!participant || participant.status === "cancelled") throw new Error("Participante não encontrado neste bolão.");
  if (participant.payment_status === "confirmed") throw new Error("Este pagamento já foi confirmado.");

  const participantShares = Number(participant.shares) || 0;
  if (shares !== participantShares) throw new Error("A quantidade de cotas não corresponde ao participante.");
  const expectedAmount = participantShares * Number(pool.share_price_cents);
  if (amountCents !== expectedAmount) throw new Error("O valor informado não corresponde ao valor das cotas.");

  const { data: payment, error: paymentError } = await supabase.from("payments").insert({ pool_id: input.poolId, participant_id: input.participantId, amount_cents: expectedAmount, status: "confirmed", receipt_path: receiptPath, confirmed_at: new Date().toISOString() }).select().single();
  if (paymentError) throw new Error(paymentError.message);
  const methodLabel = method === "cash" ? "dinheiro" : method === "other" ? "outro meio" : "Pix";
  const { error: walletError } = await supabase.from("wallet_transactions").insert({ pool_id: input.poolId, payment_id: payment.id, type: "payment_confirmed", amount_cents: expectedAmount, shares: participantShares, description: `Pagamento confirmado via ${methodLabel}`, created_by: auth.user.id });
  if (walletError) { await supabase.from("payments").delete().eq("id", payment.id); throw new Error(`Não foi possível registrar a carteira: ${walletError.message}`); }
  const { error: participantError } = await supabase.from("participants").update({ payment_status: "confirmed" }).eq("id", input.participantId).eq("pool_id", input.poolId);
  if (participantError) { await supabase.from("wallet_transactions").delete().eq("payment_id", payment.id); await supabase.from("payments").delete().eq("id", payment.id); throw new Error(`Não foi possível atualizar o participante: ${participantError.message}`); }

  await supabase.from("audit_events").insert({ pool_id: input.poolId, actor_id: auth.user.id, event_type: "payment_confirmed", entity_type: "payment", entity_id: payment.id, details: { participant_id: input.participantId, participant_name: participant.name, amount_cents: expectedAmount, shares: participantShares, method, has_receipt: Boolean(receiptPath) } });
  revalidatePath("/"); revalidatePath("/carteira"); revalidatePath("/participantes");
  return payment;
}
