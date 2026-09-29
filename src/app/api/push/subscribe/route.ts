import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage, logAppError } from "@/lib/app-error-log";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token ?? "");
    const subscription = body.subscription;
    const endpoint = String(subscription?.endpoint ?? body.endpoint ?? "");
    if (!token || !endpoint)
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

    const s = createAdminClient();
    const { data: p } = await s
      .from("participants")
      .select("id,pool_id,status,name,phone")
      .eq("access_token", token)
      .maybeSingle();
    if (!p || p.status === "cancelled")
      return NextResponse.json(
        { error: "Participante indisponível." },
        { status: 404 },
      );

    if (body.action === "status") {
      const { data: existing } = await s
        .from("push_subscriptions")
        .select("id")
        .eq("participant_id", p.id)
        .eq("pool_id", p.pool_id)
        .eq("endpoint", endpoint)
        .eq("enabled", true)
        .maybeSingle();
      if (existing) return NextResponse.json({ active: true });

      // A autorização push pertence ao aparelho/navegador. Se este mesmo
      // endpoint já estiver ativo para a mesma pessoa em outro bolão,
      // considere-o reutilizável; o POST com a subscription completa fará
      // a vinculação automática ao cadastro atual.
      const { data: endpointRows } = await s
        .from("push_subscriptions")
        .select("participant_id")
        .eq("endpoint", endpoint)
        .eq("enabled", true);
      const ids = [...new Set((endpointRows ?? []).map((row) => row.participant_id).filter(Boolean))];
      if (!ids.length) return NextResponse.json({ active: false });

      const { data: owners } = await s
        .from("participants")
        .select("id,name,phone")
        .in("id", ids)
        .neq("status", "cancelled");
      const normalizedName = p.name.trim().toLocaleLowerCase("pt-BR");
      const reusable = (owners ?? []).some(
        (owner) =>
          owner.phone === p.phone &&
          owner.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
      );
      return NextResponse.json({ active: reusable });
    }

    if (!subscription?.keys?.p256dh || !subscription?.keys?.auth)
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

    const { data: samePhoneParticipants, error: participantsError } = p.phone
      ? await s
          .from("participants")
          .select("id,pool_id,name")
          .eq("phone", p.phone)
          .neq("status", "cancelled")
      : { data: null, error: null };
    if (participantsError) throw participantsError;

    const normalizedName = p.name.trim().toLocaleLowerCase("pt-BR");
    const linkedParticipants = (samePhoneParticipants ?? []).filter(
      (participant) =>
        participant.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
    );
    if (!linkedParticipants.some((participant) => participant.id === p.id))
      linkedParticipants.push({ id: p.id, pool_id: p.pool_id, name: p.name });

    const now = new Date().toISOString();
    const { error } = await s.from("push_subscriptions").upsert(
      linkedParticipants.map((participant) => ({
        pool_id: participant.pool_id,
        participant_id: participant.id,
        endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        enabled: true,
        updated_at: now,
      })),
      { onConflict: "endpoint,participant_id" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAppError({
      source: "Notificações - ativar lembrete",
      message: errorMessage(error),
    });
    return NextResponse.json(
      { error: "Não foi possível vincular os lembretes." },
      { status: 500 },
    );
  }
}
