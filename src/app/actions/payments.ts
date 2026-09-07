"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function confirmPayment(input: { poolId: string; participantId: string; amountCents: number; shares: number }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login para continuar.");
  const { data: pool } = await supabase.from("pools").select("owner_id").eq("id", input.poolId).single();
  if (!pool || pool.owner_id !== auth.user.id) throw new Error("Somente o organizador pode confirmar pagamentos.");

  const { data: payment, error } = await supabase.from("payments").insert({
    pool_id: input.poolId,
    participant_id: input.participantId,
    amount_cents: input.amountCents,
    shares: input.shares,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  }).select().single();
  if (error) throw new Error(error.message);

  const { error: walletError } = await supabase.from("wallet_transactions").insert({
    pool_id: input.poolId,
    participant_id: input.participantId,
    payment_id: payment.id,
    type: "payment_confirmed",
    amount_cents: input.amountCents,
    shares: input.shares,
  });
  if (walletError) throw new Error(walletError.message);

  const { error: participantError } = await supabase
    .from("participants")
    .update({ payment_status: "paid" })
    .eq("id", input.participantId)
    .eq("pool_id", input.poolId);
  if (participantError) throw new Error(participantError.message);

  revalidatePath("/");
  revalidatePath("/carteira");
  revalidatePath("/participantes");
  return payment;
}
