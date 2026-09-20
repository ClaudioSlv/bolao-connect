import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const ORGANIZER_ASSETS_BUCKET = "organizer-assets";
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function validateOrganizerImage(file: File) {
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension)
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (file.size < 1 || file.size > 5 * 1024 * 1024)
    throw new Error("A imagem deve ter no máximo 5 MB.");
  return extension;
}

export async function uploadOrganizerImage(input: {
  ownerId: string;
  kind: "logo" | "pools";
  file: File;
  poolId?: string;
}) {
  const extension = validateOrganizerImage(input.file);
  const folder = input.kind === "logo" ? "logo" : `pools/${input.poolId}`;
  const path = `${input.ownerId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error } = await admin.storage
    .from(ORGANIZER_ASSETS_BUCKET)
    .upload(path, bytes, { contentType: input.file.type, upsert: false });
  if (error) throw new Error("Não foi possível enviar a imagem.");
  const { data } = admin.storage
    .from(ORGANIZER_ASSETS_BUCKET)
    .getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function removeOrganizerImage(path?: string | null) {
  if (!path) return;
  await createAdminClient().storage.from(ORGANIZER_ASSETS_BUCKET).remove([path]);
}
