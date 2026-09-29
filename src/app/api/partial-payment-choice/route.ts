import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolutionAmounts } from "@/lib/partial-payment-resolution";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {token?: string; choice?: string} | null;
  const token = String(body?.token ?? "");
  const choice = body?.choice;
  if (!token || !["refund", "credit"].includes(String(choice)))
    return NextResponse.json({error: "Escolha inválida."}, {status: 400});

  const s = createAdminClient();
  const {data: p} = await s.from("participants")
    .select("id,pool_id,status,payment_status,is_test,payment_deadline_override")
    .eq("access_token", token).maybeSingle();
  if (!p || p.is_test || !["confirmed", "expired"].includes(p.status) || p.payment_status === "confirmed")
    return NextResponse.json({error: "Esta reserva não pode ser encerrada por aqui."}, {status: 403});
  const {data: pool} = await s.from("pools").select("rules_version,payment_deadline")
    .eq("id", p.pool_id).maybeSingle();
  const deadline = p.payment_deadline_override || pool?.payment_deadline;
  if (!pool || Number(pool.rules_version) < 5 || !deadline || Date.now() <= new Date(deadline).getTime())
    return NextResponse.json({error: "O prazo desta reserva ainda não terminou."}, {status: 403});
  const policyVersion = Number(pool.rules_version);
  const {data: acceptance} = await s.from("pool_rule_acceptances").select("id")
    .eq("participant_id", p.id).eq("pool_id", p.pool_id).eq("rules_version", policyVersion).maybeSingle();
  if (!acceptance) return NextResponse.json({error: "Esta regra não foi aceita para a reserva."}, {status: 403});
  const {data: openPix, error: checkoutError} = await s.from("payment_checkout_sessions").select("id")
    .eq("participant_id", p.id).in("status", ["creating", "pending", "processing", "review_required"])
    .limit(1);
  if (checkoutError) return NextResponse.json({error: "Não foi possível conferir o Pix."}, {status: 500});
  if (openPix?.length) return NextResponse.json({error: "Há um Pix em conferência. Tente novamente após a confirmação."}, {status: 409});
  const {data: payments, error: paymentsError} = await s.from("payments")
    .select("amount_cents,credit_used_cents")
    .eq("participant_id", p.id).in("status", ["partial", "confirmed"]);
  if (paymentsError) return NextResponse.json({error: "Não foi possível conferir os pagamentos."}, {status: 500});
  const paidCents = (payments ?? []).reduce((sum, row) => sum + Number(row.amount_cents || 0) + Number(row.credit_used_cents || 0), 0);
  if (paidCents <= 0) return NextResponse.json({error: "Não há valor pago para resolver."}, {status: 409});
  const {retentionCents, amountCents} = resolutionAmounts(paidCents, choice as "refund" | "credit", policyVersion >= 6 ? 3 : 0);
  const {data: existing, error: existingError} = await s.from("partial_payment_resolution_choices").select("choice,status,amount_cents,retention_cents")
    .eq("participant_id", p.id).maybeSingle();
  if (existingError) return NextResponse.json({error: "Não foi possível conferir sua escolha."}, {status: 500});
  if (existing) return NextResponse.json({ok: true, ...existing, alreadyRequested: true});
  const {data: row, error} = await s.from("partial_payment_resolution_choices").insert({
    participant_id: p.id, pool_id: p.pool_id, choice, paid_cents: paidCents,
    retention_cents: retentionCents, amount_cents: amountCents,
  }).select("choice,status,amount_cents,retention_cents").single();
  if (error) return NextResponse.json({error: "Não foi possível registrar sua escolha. Tente novamente."}, {status: 500});
  return NextResponse.json({ok: true, ...row});
}
