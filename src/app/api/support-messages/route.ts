import { NextResponse } from "next/server";
import { getParticipantDeviceAccess } from "@/lib/participant-device-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["bug", "suggestion", "help"]);
const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const attachment = form.get("attachment");

    if (!token || !CATEGORIES.has(category) || message.length < 5 || message.length > 1500)
      return NextResponse.json({ error: "Preencha a mensagem corretamente." }, { status: 400 });

    const access = await getParticipantDeviceAccess(token);
    if (!access.valid || !access.authorized || !access.participantId)
      return NextResponse.json({ error: "Acesso do participante não confirmado." }, { status: 403 });

    const admin = createAdminClient();
    const { data: participant } = await admin
      .from("participants")
      .select("id,pool_id,name,status")
      .eq("id", access.participantId)
      .eq("access_token", token)
      .maybeSingle();
    if (!participant || participant.status === "cancelled")
      return NextResponse.json({ error: "Participante inválido." }, { status: 404 });

    let attachmentMime: string | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > 5 * 1024 * 1024 || !ALLOWED_IMAGES.has(attachment.type))
        return NextResponse.json({ error: "Envie uma imagem JPG, PNG ou WebP de até 5 MB." }, { status: 400 });
      uploadedPath = `${participant.pool_id}/${participant.id}/${crypto.randomUUID()}.${EXTENSIONS[attachment.type]}`;
      const { error: uploadError } = await admin.storage
        .from("support-attachments")
        .upload(uploadedPath, attachment, { contentType: attachment.type, upsert: false });
      if (uploadError) throw uploadError;
      attachmentMime = attachment.type;
    }

    const { data: supportMessage, error } = await admin
      .from("participant_support_messages")
      .insert({
        pool_id: participant.pool_id,
        participant_id: participant.id,
        category,
        message,
        attachment_path: uploadedPath,
        attachment_mime: attachmentMime,
      })
      .select("id")
      .single();
    if (error) throw error;

    await admin.from("audit_events").insert({
      pool_id: participant.pool_id,
      event_type: "participant_support_message",
      entity_type: "participant_support_message",
      entity_id: supportMessage.id,
      details: {
        participant_name: participant.name,
        category,
        preview: message.slice(0, 120),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("participant-support-message:", error);
    if (uploadedPath) {
      try {
        await createAdminClient().storage.from("support-attachments").remove([uploadedPath]);
      } catch {}
    }
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente novamente." }, { status: 500 });
  }
}
