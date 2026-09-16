import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_PREFIX = "btp_participant_device_";

export function participantCookieName(token: string) {
  return `${COOKIE_PREFIX}${createHash("sha256").update(token).digest("hex").slice(0, 18)}`;
}

export function participantSessionHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function getParticipantDeviceAccess(token: string) {
  const admin = createAdminClient();
  const { data: participant } = await admin
    .from("participants")
    .select("id,status")
    .eq("access_token", token)
    .maybeSingle();

  if (!participant || participant.status === "cancelled") {
    return { valid: false, authorized: false, participantId: null as string | null };
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(participantCookieName(token))?.value ?? "";
  if (!sessionValue) {
    return { valid: true, authorized: false, participantId: participant.id as string };
  }

  const { data: session } = await admin
    .from("participant_device_sessions")
    .select("id,expires_at,revoked_at")
    .eq("participant_id", participant.id)
    .eq("session_hash", participantSessionHash(sessionValue))
    .maybeSingle();

  const authorized = Boolean(
    session &&
      !session.revoked_at &&
      new Date(session.expires_at).getTime() > Date.now(),
  );

  return { valid: true, authorized, participantId: participant.id as string };
}

export async function requireParticipantDeviceAccess(token: string) {
  const access = await getParticipantDeviceAccess(token);
  if (access.valid && !access.authorized) {
    redirect(`/verificar-participante/${encodeURIComponent(token)}`);
  }
  return access;
}
