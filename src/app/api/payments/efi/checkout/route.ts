import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_POOL_RULES_VERSION } from "@/lib/pool-rules";
import { efiConfigured, efiRequest } from "@/lib/efi";
import { maxInstallments } from "@/lib/payment-installments";

const digits = (value: string) => value.replace(/\D/g, "");
const installmentValues = (total: number, count: number) => {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? total - base * count : 0));
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!efiConfigured()) return NextResponse.json({ error: "A Efí ainda não está configurada." }, { status: 503 });
    const body = await request.json().catch(() => null) as {
      token?: string;
      useCredit?: boolean;
      paymentMode?: "full" | "partial";
      installmentCount?: number;
      installmentsToPay?: number;
    } | null;
    const token = String(body?.token || "");
    if (!token) return NextResponse.json({ error: "Participante inválido." }, { status: 400 });

    const s = createAdminClient();
    const { data: p } = await s.from("participants").select("id,pool_id,name,phone,shares,status,payment_status,is_test,test_amount_cents,payment_deadline_override").eq("access_token", token).maybeSingle();
    if (!p || p.status !== "confirmed") return NextResponse.json({ error: "Esta participação não está disponível para pagamento." }, { status: 404 });
    if (p.payment_status === "confirmed") return NextResponse.json({ error: "Esta cota já está paga." }, { status: 409 });
    const { data: pool } = await s.from("pools").select("id,owner_id,title,share_price_cents,payment_opens_at,payment_deadline,rules_version").eq("id", p.pool_id).maybeSingle();
    if (!pool) return NextResponse.json({ error: "Bolão não encontrado." }, { status: 404 });

    const now = Date.now();
    const opens = pool.payment_opens_at ? new Date(pool.payment_opens_at).getTime() : 0;
    const closes = p.payment_deadline_override ? new Date(p.payment_deadline_override).getTime() : pool.payment_deadline ? new Date(pool.payment_deadline).getTime() : 0;
    if (!p.is_test && opens && now < opens) return NextResponse.json({ error: "Os pagamentos deste bolão ainda não foram abertos." }, { status: 403 });
    if (!p.is_test && closes && now > closes) return NextResponse.json({ error: "O prazo de pagamento foi encerrado." }, { status: 403 });

    const version = Number(pool.rules_version || DEFAULT_POOL_RULES_VERSION);
    const { data: acceptance } = await s.from("pool_rule_acceptances").select("id").eq("pool_id", pool.id).eq("participant_id", p.id).eq("rules_version", version).maybeSingle();
    if (!acceptance) return NextResponse.json({ error: "Aceite as Regras do Bolão antes de gerar o pagamento." }, { status: 403 });

    const total = p.is_test ? Number(p.test_amount_cents || 100) : Number(p.shares) * Number(pool.share_price_cents);
    const { data: previousPayments } = await s.from("payments").select("amount_cents,credit_used_cents").eq("participant_id", p.id).in("status", ["partial", "confirmed"]);
    const paidBefore = (previousPayments || []).reduce((sum, row) => sum + Number(row.amount_cents || 0) + Number(row.credit_used_cents || 0), 0);
    const remaining = Math.max(0, total - paidBefore);
    if (remaining <= 0) {
      await s.from("participants").update({ payment_status: "confirmed" }).eq("id", p.id);
      return NextResponse.json({ paid: true, alreadyPaid: true });
    }

    const paymentMode = body?.paymentMode === "partial" && !p.is_test ? "partial" : "full";
    let plan: any = null;
    let target = remaining;
    let installmentsToPay = 1;
    if (paymentMode === "partial") {
      const { data: existingPlan } = await s.from("participant_payment_plans").select("id,installment_count,total_amount_cents").eq("participant_id", p.id).maybeSingle();
      plan = existingPlan;
      if (!plan) {
        const count = Math.trunc(Number(body?.installmentCount));
        const maximum = maxInstallments(total);
        if (!Number.isInteger(count) || count < 2 || count > maximum) return NextResponse.json({ error: `Escolha de 2 a ${maximum} parcelas para esta cota.` }, { status: 400 });
        const { data: created, error } = await s.from("participant_payment_plans").insert({ participant_id: p.id, pool_id: p.pool_id, installment_count: count, total_amount_cents: total }).select("id,installment_count,total_amount_cents").single();
        if (error) return NextResponse.json({ error: "Não foi possível criar o plano de pagamento." }, { status: 409 });
        plan = created;
      }
      const schedule = installmentValues(Number(plan.total_amount_cents), Number(plan.installment_count));
      let accumulated = 0;
      let nextIndex = 0;
      while (nextIndex < schedule.length && accumulated + schedule[nextIndex] <= paidBefore) {
        accumulated += schedule[nextIndex];
        nextIndex++;
      }
      const availableUnits = Math.max(1, schedule.length - nextIndex);
      installmentsToPay = Math.min(availableUnits, Math.max(1, Math.trunc(Number(body?.installmentsToPay || 1))));
      target = Math.min(remaining, schedule.slice(nextIndex, nextIndex + installmentsToPay).reduce((sum, value) => sum + value, 0));
    }

    let credit = 0;
    const useCredit = body?.useCredit === true;
    if (useCredit && !p.is_test && p.phone) {
      const { data: account } = await s.from("participant_credit_accounts").select("balance_cents").eq("owner_id", pool.owner_id).eq("phone", digits(p.phone)).maybeSingle();
      credit = Number(account?.balance_cents || 0);
    }
    const creditUsed = Math.min(target, credit);
    const due = target - creditUsed;

    const { data: existing } = await s.from("payment_checkout_sessions").select("provider_order_id,qr_code_text,qr_code_expires_at,gross_amount_cents,credit_used_cents,expected_amount_cents").eq("participant_id", p.id).eq("provider", "efi").in("status", ["creating", "pending", "processing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const existingMatchesChoice = existing && Number(existing.gross_amount_cents) === target && Number(existing.credit_used_cents) === creditUsed && Number(existing.expected_amount_cents) === due;
    if (existingMatchesChoice && existing?.qr_code_text && existing.qr_code_expires_at && new Date(existing.qr_code_expires_at).getTime() > now) {
      return NextResponse.json({ orderId: existing.provider_order_id, qrCodeText: existing.qr_code_text, qrCodeImage: await QRCode.toDataURL(existing.qr_code_text, { width: 360, margin: 1 }), expiresAt: existing.qr_code_expires_at, grossAmountCents: target, creditUsedCents: creditUsed, amountCents: due, installmentsPaid: installmentsToPay, reused: true });
    }
    if (existing) {
      await s.from("payment_checkout_sessions").update({ status: "failed", failure_reason: !existingMatchesChoice ? "efi_payment_choice_changed" : "efi_qr_expired_replaced", updated_at: new Date().toISOString() }).eq("participant_id", p.id).eq("provider", "efi").in("status", ["creating", "pending", "processing"]);
    }

    if (due <= 0) {
      const { data: settlement, error } = await s.rpc("settle_participation_credit_amount", { p_participant_id: p.id, p_target_cents: target });
      if (error) return NextResponse.json({ error: error.message || "Não foi possível utilizar o crédito." }, { status: 409 });
      return NextResponse.json({ paid: Boolean(settlement?.paid), partial: Boolean(settlement?.partial), creditOnly: true, paymentConfirmed: true, creditUsedCents: target, amountCents: 0, remainingCents: settlement?.remaining_cents, installmentsPaid: installmentsToPay });
    }

    const referenceId = `efi-${p.id}-${crypto.randomUUID().slice(0, 12)}`;
    const expirationSeconds = 1800;
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000).toISOString();
    const { error: insertError } = await s.from("payment_checkout_sessions").insert({ pool_id: pool.id, participant_id: p.id, provider: "efi", order_nsu: referenceId, gross_amount_cents: target, credit_used_cents: creditUsed, expected_amount_cents: due, status: "creating", is_test: Boolean(p.is_test) });
    if (insertError) return NextResponse.json({ error: "Sua cobrança está sendo gerada. Aguarde alguns segundos e tente novamente." }, { status: 409 });

    const charge = await efiRequest("/v2/cob", { method: "POST", body: { calendario: { expiracao: expirationSeconds }, valor: { original: (due / 100).toFixed(2) }, chave: process.env.EFI_PIX_KEY, solicitacaoPagador: `Bolão Amigos BTP - ${pool.title}`, infoAdicionais: [{ nome: "Participante", valor: String(p.name).slice(0, 50) }] } });
    if (charge.status < 200 || charge.status >= 300 || !charge.data?.txid || !charge.data?.loc?.id) {
      await s.from("payment_checkout_sessions").update({ status: "failed", failure_reason: `efi_${charge.status}`, updated_at: new Date().toISOString() }).eq("order_nsu", referenceId);
      return NextResponse.json({ error: charge.data?.mensagem || charge.data?.detail || `A Efí recusou a cobrança (HTTP ${charge.status}).` }, { status: 502 });
    }
    const qr = await efiRequest(`/v2/loc/${charge.data.loc.id}/qrcode`);
    if (qr.status < 200 || qr.status >= 300 || !qr.data?.qrcode) {
      await s.from("payment_checkout_sessions").update({ status: "failed", provider_order_id: charge.data.txid, failure_reason: `efi_qr_${qr.status}`, updated_at: new Date().toISOString() }).eq("order_nsu", referenceId);
      return NextResponse.json({ error: qr.data?.mensagem || "Cobrança criada, mas não foi possível gerar o QR Code." }, { status: 502 });
    }
    await s.from("payment_checkout_sessions").update({ provider_order_id: charge.data.txid, qr_code_text: qr.data.qrcode, qr_code_expires_at: expiresAt, status: "pending", updated_at: new Date().toISOString() }).eq("order_nsu", referenceId);
    return NextResponse.json({ orderId: charge.data.txid, qrCodeText: qr.data.qrcode, qrCodeImage: await QRCode.toDataURL(qr.data.qrcode, { width: 360, margin: 1 }), expiresAt, grossAmountCents: target, creditUsedCents: creditUsed, amountCents: due, installmentsPaid: installmentsToPay });
  } catch (error) {
    console.error("Efi checkout", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao gerar Pix Efí." }, { status: 500 });
  }
}
