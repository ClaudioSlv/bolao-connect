"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAppError } from "@/lib/app-error-log";
import { sendReceiptPublishedPush } from "@/lib/send-receipt-push";
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]),
  max = 15 * 1024 * 1024;

async function requireOwner(poolId: string) {
  const client = await createClient(),
    { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Faça login.");
  const { data: pool } = await client
    .from("pools")
    .select("owner_id,contest_number")
    .eq("id", poolId)
    .single();
  if (!pool || pool.owner_id !== auth.user.id)
    throw new Error("Você não pode publicar neste bolão.");
  return { userId: auth.user.id, contestNumber: pool.contest_number };
}

export async function uploadGameReceiptFile(form: FormData) {
  const poolId = String(form.get("poolId") ?? ""),
    title = String(form.get("title") ?? "")
      .trim()
      .slice(0, 100),
    file = form.get("receipt");
  if (!poolId || !(file instanceof File) || !file.size)
    throw new Error("Selecione a foto inteira do comprovante.");
  if (!allowed.has(file.type)) throw new Error("Use JPG, PNG ou WebP.");
  if (file.size > max) throw new Error("Cada foto deve ter no máximo 15 MB.");
  const owner = await requireOwner(poolId),
    admin = createAdminClient(),
    ext = file.type.split("/")[1].replace("jpeg", "jpg"),
    id = crypto.randomUUID(),
    path = `${poolId}/${id}.${ext}`,
    { error: uploadError } = await admin.storage
      .from("game-receipts")
      .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await logAppError({
      source: "Comprovantes - enviar imagem",
      message: uploadError.message,
      poolId,
      details: { mime_type: file.type, file_size: file.size },
    });
    throw uploadError;
  }
  const { error } = await admin
    .from("game_receipts")
    .insert({
      id,
      pool_id: poolId,
      title: title || "Comprovante dos jogos",
      contest_number: owner.contestNumber,
      storage_path: path,
      mime_type: file.type,
      original_name: file.name,
      file_size: file.size,
      status: "published",
      published_by: owner.userId,
    });
  if (error) {
    await admin.storage.from("game-receipts").remove([path]);
    throw error;
  }
  return { id };
}

export async function notifyGameReceiptBatch(input: {
  poolId: string;
  receiptIds: string[];
  title: string;
}) {
  await requireOwner(input.poolId);
  if (!input.receiptIds.length) return { sent: 0, failed: 0 };
  const subject =
      input.title.replace(/^comprovante\s*[-·:]?\s*/i, "").trim() || "jogos",
    receiptTitle =
      input.receiptIds.length === 1
        ? `O comprovante de ${subject}`
        : `${input.receiptIds.length} novos comprovantes de ${subject}`;
  try {
    return await sendReceiptPublishedPush({
      poolId: input.poolId,
      receiptId: input.receiptIds[0],
      receiptTitle,
    });
  } catch (error) {
    await logAppError({
      source: "Comprovantes - notificação em lote",
      message:
        error instanceof Error ? error.message : "Falha ao enviar notificação",
      poolId: input.poolId,
      details: { receipt_ids: input.receiptIds },
    });
    return { sent: 0, failed: 0 };
  }
}
