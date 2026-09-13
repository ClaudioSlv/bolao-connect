"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveManualPix(form: FormData) {
  const key = String(form.get("pixKey") || "").trim(),
    type = String(form.get("pixKeyType") || "");
  if (!key || !["cpf", "cnpj", "email", "phone", "random"].includes(type))
    throw new Error("Informe uma chave Pix válida.");
  const s = await createClient(),
    { data: auth } = await s.auth.getUser();
  if (!auth.user) throw new Error("Faça login.");
  const { error } = await s
    .from("organizer_payment_accounts")
    .upsert(
      {
        owner_id: auth.user.id,
        provider: "pagbank",
        manual_pix_key: key,
        manual_pix_key_type: type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,provider" },
    );
  if (error) throw new Error("Não foi possível salvar a chave Pix.");
  revalidatePath("/menu/conta-recebimento");
}
