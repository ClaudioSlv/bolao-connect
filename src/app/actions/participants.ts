"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requirePoolOwner(poolId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login para continuar.");
  const { data: pool } = await supabase.from("pools").select("id,owner_id").eq("id", poolId).single();
  if (!pool || pool.owner_id !== auth.user.id) throw new Error("Você não pode alterar este bolão.");
  return supabase;
}

export async function addParticipant(input: { poolId: string; name: string; shares: number; phone?: string }) {
  const supabase = await requirePoolOwner(input.poolId);
  const { data, error } = await supabase.from("participants").insert({
    pool_id: input.poolId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    shares: input.shares,
    status: "confirmed",
    payment_status: "pending",
  }).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/participantes");
  return data;
}
