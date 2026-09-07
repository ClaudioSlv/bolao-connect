"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LotteryId } from "@/lib/domain";

const lotteryRules: Record<LotteryId, { min: number; max: number; minNumbers: number; maxNumbers: number }> = {
  "mega-sena": { min: 1, max: 60, minNumbers: 6, maxNumbers: 20 },
  lotofacil: { min: 1, max: 25, minNumbers: 15, maxNumbers: 20 },
  quina: { min: 1, max: 80, minNumbers: 5, maxNumbers: 15 },
  "dupla-sena": { min: 1, max: 50, minNumbers: 6, maxNumbers: 15 },
  lotomania: { min: 0, max: 99, minNumbers: 50, maxNumbers: 50 },
  timemania: { min: 1, max: 80, minNumbers: 10, maxNumbers: 10 },
  "dia-de-sorte": { min: 1, max: 31, minNumbers: 7, maxNumbers: 15 },
  "super-sete": { min: 0, max: 9, minNumbers: 7, maxNumbers: 7 },
  "mais-milionaria": { min: 1, max: 50, minNumbers: 6, maxNumbers: 12 },
};

async function requirePoolOwner(poolId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login para continuar.");
  const { data: pool, error } = await supabase.from("pools").select("id,owner_id,lottery,contest_number").eq("id", poolId).single();
  if (error || !pool || pool.owner_id !== auth.user.id) throw new Error("Você não pode alterar este bolão.");
  return { supabase, lottery: pool.lottery as LotteryId, contestNumber: pool.contest_number as number | null };
}

export async function addGame(input: { poolId: string; numbers: number[]; receiptPath?: string }) {
  if (!input.poolId) throw new Error("Bolão não informado.");
  if (!Array.isArray(input.numbers) || input.numbers.length === 0) throw new Error("Informe as dezenas do jogo.");

  const numbers = input.numbers.map(Number);
  if (numbers.some((number) => !Number.isInteger(number))) throw new Error("As dezenas informadas são inválidas.");

  const { supabase, lottery, contestNumber } = await requirePoolOwner(input.poolId);
  const rule = lotteryRules[lottery];
  if (!rule) throw new Error("Modalidade não suportada.");
  if (numbers.length < rule.minNumbers || numbers.length > rule.maxNumbers) throw new Error(`Quantidade de dezenas inválida para esta modalidade. Use de ${rule.minNumbers} a ${rule.maxNumbers}.`);
  if (new Set(numbers).size !== numbers.length) throw new Error("Não repita dezenas no mesmo jogo.");
  if (numbers.some((number) => number < rule.min || number > rule.max)) throw new Error(`As dezenas devem ficar entre ${rule.min} e ${rule.max}.`);

  const receiptPath = input.receiptPath?.trim() || null;
  const sortedNumbers = [...numbers].sort((a, b) => a - b);
  const { data, error } = await supabase.from("games").insert({
    pool_id: input.poolId,
    lottery,
    contest_number: contestNumber,
    numbers: sortedNumbers,
    receipt_path: receiptPath,
  }).select().single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/jogos");
  revalidatePath("/conferencia");
  return data;
}
