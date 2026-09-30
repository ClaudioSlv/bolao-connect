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
      if (!ids.length) {
        const { data: expired } = await s.from("push_subscriptions")
          .select("id").eq("endpoint", endpoint).eq("enabled", false).limit(1);
        return NextResponse.json({ active: false, expired: Boolean(expired?.length) });
      }

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

    // A inscrição push pertence ao navegador, não ao link do participante.
    // Abrir o link de outra pessoa no mesmo aparelho não pode vincular as
    // notificações financeiras dela a este aparelho automaticamente.
    const { data: existingEndpointRows, error: endpointError } = await s
      .from("push_subscriptions")
      .select("participant_id")
      .eq("endpoint", endpoint)
      .eq("enabled", true);
    if (endpointError) throw endpointError;
    if (!existingEndpointRows?.length) {
      const { data: expired, error: expiredError } = await s
        .from("push_subscriptions").select("id")
        .eq("endpoint", endpoint).eq("enabled", false).limit(1);
      if (expiredError) throw expiredError;
      if (expired?.length)
        return NextResponse.json({ error: "Inscrição expirada. Ative novamente no aparelho." }, { status: 410 });
    }
    const otherParticipantIds = [...new Set((existingEndpointRows ?? [])
      .map((row) => row.participant_id)
      .filter((id) => id && id !== p.id))];
    if (otherParticipantIds.length) {
      const { data: owners, error: ownersError } = await s
        .from("participants")
        .select("id,name,phone,status")
        .in("id", otherParticipantIds);
      if (ownersError) throw ownersError;
      const normalizedName = p.name.trim().toLocaleLowerCase("pt-BR");
      const belongsToAnotherPerson = (owners ?? []).some(
        (owner) => owner.status !== "cancelled" &&
          (owner.phone !== p.phone || owner.name.trim().toLocaleLowerCase("pt-BR") !== normalizedName),
      );
      if (belongsToAnotherPerson)
        return NextResponse.json(
          { error: "Este aparelho já recebe notificações de outro participante." },
          { status: 409 },
        );
    }

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
