"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requirePoolOwner(poolId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login para continuar.");

  const { data: pool, error } = await supabase
    .from("pools")
    .select("id,owner_id")
    .eq("id", poolId)
    .single();

  if (error || !pool || pool.owner_id !== auth.user.id) {
    throw new Error("Você não pode alterar este bolão.");
  }

  return supabase;
}

export async function addGame(input: {
  poolId: string;
  numbers: number[];
  betAmountCents?: number;
  receiptUrl?: string;
}) {
  if (!input.poolId) throw new Error("Bolão não informado.");
  if (!Array.isArray(input.numbers) || input.numbers.length === 0) {
    throw new Error("Informe as dezenas do jogo.");
  }

  const numbers = input.numbers.map(Number);
  if (numbers.some((number) => !Number.isInteger(number) || number < 0)) {
    throw new Error("As dezenas informadas são inválidas.");
  }

  const supabase = await requirePoolOwner(input.poolId);
  const { data, error } = await supabase
    .from("games")
    .insert({
      pool_id: input.poolId,
      numbers,
      bet_amount_cents: input.betAmountCents ?? null,
      receipt_url: input.receiptUrl?.trim() || null,
      status: "registered",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/jogos");
  return data;
}
