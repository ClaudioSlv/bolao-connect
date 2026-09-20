import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getParticipantDeviceAccess } from "@/lib/participant-device-access";
import { ParticipantActivityTracker } from "@/components/participant-activity-tracker";
import { ParticipantSupportButton } from "@/components/participant-support-button";

export const dynamic = "force-dynamic";

export default async function ParticipantProtectedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const access = await getParticipantDeviceAccess(token);

  if (access.valid && !access.authorized) {
    redirect(`/verificar-participante/${encodeURIComponent(token)}`);
  }

  return <>{children}{access.authorized ? <><ParticipantActivityTracker token={token} /><ParticipantSupportButton token={token} /></> : null}</>;
}
