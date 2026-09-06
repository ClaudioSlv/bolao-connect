"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LotteryId } from "@/lib/domain";

export type CreatePoolInput = {
  title: string;
  lottery: LotteryId;
  totalShares: number;
  sharePriceCents: number;
  paymentDeadline: string;
  drawAt?: string;
  estimatedPrizeCents?: number;
};

export async function createPool(input: CreatePoolInput) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para criar um bolão.");

  const slugBase = input.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "bolao";
  const publicSlug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase
    .from("pools")
    .insert({
      owner_id: auth.user.id,
      title: input.title.trim(),
      lottery: input.lottery,
      total_shares: input.totalShares,
      share_price_cents: input.sharePriceCents,
      payment_deadline: input.paymentDeadline,
      draw_at: input.drawAt || null,
      estimated_prize_cents: input.estimatedPrizeCents ?? null,
      status: "open",
      public_slug: publicSlug,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/criar-bolao");
  return data;
}
