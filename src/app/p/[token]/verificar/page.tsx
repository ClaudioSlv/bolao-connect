import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getParticipantDeviceAccess,
  participantCookieName,
  participantSessionHash,
} from "@/lib/participant-device-access";

export const dynamic = "force-dynamic";

const SESSION_DAYS = 180;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function confirmDevice(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");
  const last4 = digits(String(formData.get("last4") ?? "")).slice(-4);
  const admin = createAdminClient();

  const { data: participant } = await admin
    .from("participants")
    .select("id,phone,status")
    .eq("access_token", token)
    .maybeSingle();

  if (!participant || participant.status === "cancelled") {
    redirect(`/p/${encodeURIComponent(token)}/verificar?erro=link`);
  }

  const { data: attempts } = await admin
    .from("participant_access_attempts")
    .select("failed_attempts,locked_until")
    .eq("participant_id", participant.id)
    .maybeSingle();

  if (attempts?.locked_until && new Date(attempts.locked_until).getTime() > Date.now()) {
    redirect(`/p/${encodeURIComponent(token)}/verificar?erro=bloqueado`);
  }

  const phone = digits(String(participant.phone ?? ""));
  if (last4.length !== 4 || phone.length < 4 || phone.slice(-4) !== last4) {
    const failedAttempts = Number(attempts?.failed_attempts ?? 0) + 1;
    const lockedUntil =
      failedAttempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;

    await admin.from("participant_access_attempts").upsert(
      {
        participant_id: participant.id,
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id" },
    );

    redirect(
      `/p/${encodeURIComponent(token)}/verificar?erro=${lockedUntil ? "bloqueado" : "digitos"}`,
    );
  }

  await admin.from("participant_access_attempts").delete().eq("participant_id", participant.id);
  await admin
    .from("participant_device_sessions")
    .delete()
    .eq("participant_id", participant.id)
    .lt("expires_at", new Date().toISOString());

  const sessionValue = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await admin.from("participant_device_sessions").insert({
    participant_id: participant.id,
    session_hash: participantSessionHash(sessionValue),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    redirect(`/p/${encodeURIComponent(token)}/verificar?erro=sessao`);
  }

  const cookieStore = await cookies();
  cookieStore.set(participantCookieName(token), sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  redirect(`/p/${encodeURIComponent(token)}`);
}

export default async function VerifyParticipantDevice({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { token } = await params;
  const { erro } = await searchParams;
  const access = await getParticipantDeviceAccess(token);

  if (!access.valid) {
    return (
      <main className="shell">
        <section className="section">
          <p className="eyebrow">ACESSO DO PARTICIPANTE</p>
          <h1>Link inválido</h1>
          <p className="muted">Este link não corresponde a uma participação ativa.</p>
        </section>
      </main>
    );
  }

  if (access.authorized) redirect(`/p/${encodeURIComponent(token)}`);

  const message =
    erro === "digitos"
      ? "Os 4 dígitos informados não conferem com o WhatsApp cadastrado."
      : erro === "bloqueado"
        ? "Muitas tentativas incorretas. Tente novamente em 15 minutos."
        : erro === "sessao"
          ? "Não foi possível autorizar este aparelho agora. Tente novamente."
          : "";

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">PROTEÇÃO DO PAINEL</p>
        <h1>Confirmar este aparelho</h1>
        <p className="muted">
          Para evitar que um link enviado por engano abra o painel de outra pessoa,
          confirme os últimos 4 dígitos do WhatsApp usado na sua reserva.
        </p>
        <p className="status">
          Esta confirmação é feita somente na primeira abertura neste aparelho ou navegador.
        </p>

        <form className="form" action={confirmDevice}>
          <input type="hidden" name="token" value={token} />
          <div className="field">
            <label>Últimos 4 dígitos do WhatsApp</label>
            <input
              name="last4"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="0000"
              required
            />
          </div>

          {message && (
            <p className="status" role="alert" style={{ color: "#facc15" }}>
              {message}
            </p>
          )}

          <button className="button primary" type="submit">
            CONFIRMAR E ABRIR MEU PAINEL
          </button>
        </form>
      </section>
    </main>
  );
}
