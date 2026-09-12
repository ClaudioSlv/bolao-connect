import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pagBankSandboxFetch } from "@/lib/pagbank";

type PagBankOrder = {
  id?: string;
  reference_id?: string;
  charges?: Array<{
    id?: string;
    status?: string;
    amount?: { value?: number };
  }>;
};

export async function POST(request: Request) {
  if (!process.env.PAGBANK_SANDBOX_TOKEN)
    return NextResponse.json({ error: "Integração não configurada." }, { status: 503 });
  const payload = (await request.json().catch(() => null)) as PagBankOrder | null;
  if (!payload?.id)
    return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });

  // Nunca confiamos somente no webhook: consultamos o pedido diretamente no PagBank.
  const verification = await pagBankSandboxFetch(`/orders/${encodeURIComponent(payload.id)}`);
  const order = (await verification.json().catch(() => null)) as PagBankOrder | null;
  if (!verification.ok || !order?.id || !order.reference_id)
    return NextResponse.json({ error: "Não foi possível validar o pedido." }, { status: 400 });

  const paidCharge = order.charges?.find((charge) => charge.status === "PAID");
  if (!paidCharge)
    return NextResponse.json({ received: true, paid: false });

  const s = createAdminClient();
  const { data: session } = await s
    .from("pagbank_sandbox_sessions")
    .select("id,pool_id,participant_id,reference_id,amount_cents,status")
    .eq("provider_order_id", order.id)
    .eq("reference_id", order.reference_id)
    .maybeSingle();
  if (!session)
    return NextResponse.json({ error: "Cobrança de teste não encontrada." }, { status: 404 });
  if (session.status === "paid")
    return NextResponse.json({ received: true, duplicate: true });
  if (Number(paidCharge.amount?.value) !== Number(session.amount_cents))
    return NextResponse.json({ error: "Valor do Pix diferente do esperado." }, { status: 409 });

  const { data: participant } = await s
    .from("participants")
    .select("id,is_test,payment_status")
    .eq("id", session.participant_id)
    .eq("pool_id", session.pool_id)
    .eq("is_test", true)
    .maybeSingle();
  if (!participant)
    return NextResponse.json({ error: "Participante de teste não encontrado." }, { status: 404 });

  await s
    .from("pagbank_sandbox_sessions")
    .update({
      status: "paid",
      charge_id: paidCharge.id,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "pending");
  await s
    .from("participants")
    .update({ payment_status: "confirmed" })
    .eq("id", participant.id)
    .eq("is_test", true);
  await s.from("audit_events").insert({
    pool_id: session.pool_id,
    event_type: "pagbank_sandbox_payment_confirmed",
    entity_type: "participant",
    entity_id: participant.id,
    details: {
      provider: "pagbank_sandbox",
      order_id: order.id,
      charge_id: paidCharge.id,
      amount_cents: session.amount_cents,
    },
  });
  return NextResponse.json({ received: true, paid: true });
}

