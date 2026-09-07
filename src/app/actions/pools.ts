"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LotteryId } from "@/lib/domain";

const LOTTERIES: LotteryId[] = ["mega-sena","lotofacil","quina","dupla-sena","lotomania","timemania","dia-de-sorte","super-sete","mais-milionaria"];

export type CreatePoolInput = {
  title: string;
  lottery: LotteryId;
  contestNumber?: number;
  totalShares: number;
  sharePriceCents: number;
  paymentDeadline: string;
  drawAt?: string;
  estimatedPrizeCents?: number;
};

export async function createPool(input: CreatePoolInput) {
  const title = input.title.trim();
  if (!title || title.length > 120) throw new Error("Informe um nome válido para o bolão.");
  if (!LOTTERIES.includes(input.lottery)) throw new Error("Modalidade inválida.");
  if (input.contestNumber != null && (!Number.isInteger(input.contestNumber) || input.contestNumber < 1)) throw new Error("Informe um concurso válido.");
  if (!Number.isInteger(input.totalShares) || input.totalShares < 1 || input.totalShares > 100000) throw new Error("Informe uma quantidade válida de cotas.");
  if (!Number.isInteger(input.sharePriceCents) || input.sharePriceCents < 1) throw new Error("Informe um valor válido para a cota.");
  const deadline = new Date(input.paymentDeadline);
  if (Number.isNaN(deadline.getTime())) throw new Error("Informe um prazo de pagamento válido.");

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para criar um bolão.");

  const slugBase = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bolao";
  const publicSlug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase.from("pools").insert({
    owner_id: auth.user.id,
    title,
    lottery: input.lottery,
    contest_number: input.contestNumber ?? null,
    total_shares: input.totalShares,
    share_price_cents: input.sharePriceCents,
    payment_deadline: deadline.toISOString(),
    draw_at: input.drawAt || null,
    estimated_prize_cents: input.estimatedPrizeCents ?? null,
    status: "open",
    public_slug: publicSlug,
  }).select().single();

  if (error) throw new Error(error.message);
  revalidatePath("/"); revalidatePath("/criar-bolao"); revalidatePath("/jogos"); revalidatePath("/conferencia");
  return data;
}
