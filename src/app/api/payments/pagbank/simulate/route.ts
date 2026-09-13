import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentConfirmedPush } from "@/lib/send-payment-push";

export async function POST(request: Request) {
  if (process.env.PAGBANK_ENVIRONMENT?.trim().toLowerCase() === "production")
    return NextResponse.json({ error: "Simulação desativada em produção." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = String(body?.token || "");
  if (!token) return NextResponse.json({ error: "Participante inválido." }, { status: 400 });

  const s = createAdminClient();
  const { data: participant } = await s
    .from("participants")
    .select("id,pool_id,name,payment_status,is_test")
    .eq("access_token", token)
    .eq("is_test", true)
    .maybeSingle();
  if (!participant)
    return NextResponse.json({ error: "Esta simulação só funciona para cliente teste." }, { status: 403 });
  if (participant.payment_status === "confirmed") return NextResponse.json({ paid: true });

  const { data: session } = await s
    .from("payment_checkout_sessions")
    .select("id,provider_order_id,gross_amount_cents,expected_amount_cents,status")
    .eq("participant_id", participant.id)
    .eq("provider", "pagbank")
    .eq("is_test", true)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session?.provider_order_id)
    return NextResponse.json({ error: "Gere primeiro o QR Code de teste." }, { status: 409 });

  const transactionId = `sandbox-simulation-${crypto.randomUUID()}`;
  const { data: claimed } = await s
    .from("payment_checkout_sessions")
    .update({ status: "processing", transaction_nsu: transactionId, paid_amount_cents: session.expected_amount_cents, updated_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ error: "A simulação já está sendo processada." }, { status: 409 });

  const amount = Number(session.expected_amount_cents || 100);
  const { data: payment, error } = await s.from("payments").insert({
    pool_id: participant.pool_id,
    participant_id: participant.id,
    amount_cents: amount,
    gross_amount_cents: Number(session.gross_amount_cents || amount),
    credit_used_cents: 0,
    status: "confirmed",
    payment_method: "pix",
    confirmed_at: new Date().toISOString(),
    provider: "pagbank",
    provider_reference: session.provider_order_id,
    provider_transaction_nsu: transactionId,
    is_test: true,
  }).select("id").single();
  if (error || !payment) {
    await s.from("payment_checkout_sessions").update({ status: "review_required", failure_reason: error?.code || "simulation_failed" }).eq("id", session.id);
    return NextResponse.json({ error: "Não foi possível concluir a simulação." }, { status: 500 });
  }

  await s.from("participants").update({ payment_status: "confirmed" }).eq("id", participant.id);
  await s.from("payment_checkout_sessions").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", session.id);
  await s.from("audit_events").insert({
    pool_id: participant.pool_id,
    event_type: "test_payment_simulated",
    entity_type: "payment",
    entity_id: payment.id,
    details: { participant_id: participant.id, participant_name: participant.name, provider: "pagbank", sandbox: true, amount_cents: amount },
  });
  try { await sendPaymentConfirmedPush({ participantId: participant.id, amountCents: amount }); }
  catch (error) { console.error("Falha no push da simulação PagBank", error); }

  return NextResponse.json({ paid: true, simulated: true });
}
