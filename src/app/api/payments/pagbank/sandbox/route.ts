import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pagBankSandboxFetch } from "@/lib/pagbank";
import { DEFAULT_POOL_RULES_VERSION } from "@/lib/pool-rules";

type PagBankOrder = {
  id?: string;
  qr_codes?: Array<{
    id?: string;
    text?: string;
    expiration_date?: string;
    links?: Array<{ rel?: string; href?: string; media?: string }>;
  }>;
  error_messages?: Array<{ code?: string; parameter_name?: string; description?: string }>;
};

export async function POST(request: Request) {
  if (!process.env.PAGBANK_SANDBOX_TOKEN)
    return NextResponse.json(
      { error: "PagBank Sandbox ainda não está configurado neste ambiente." },
      { status: 503 },
    );

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const accessToken = String(body?.token || "");
  if (!accessToken)
    return NextResponse.json({ error: "Participante inválido." }, { status: 400 });

  const s = createAdminClient();
  const { data: participant } = await s
    .from("participants")
    .select("id,pool_id,name,email,phone,status,payment_status,is_test,test_amount_cents")
    .eq("access_token", accessToken)
    .eq("is_test", true)
    .maybeSingle();
  if (!participant || participant.status !== "confirmed")
    return NextResponse.json({ error: "Teste não encontrado." }, { status: 404 });
  if (participant.payment_status === "confirmed")
    return NextResponse.json({ error: "Este teste já foi confirmado." }, { status: 409 });

  const { data: pool } = await s
    .from("pools")
    .select("id,title,rules_version")
    .eq("id", participant.pool_id)
    .maybeSingle();
  if (!pool)
    return NextResponse.json({ error: "Bolão não encontrado." }, { status: 404 });

  const version = Number(pool.rules_version || DEFAULT_POOL_RULES_VERSION);
  const { data: acceptance } = await s
    .from("pool_rule_acceptances")
    .select("id")
    .eq("pool_id", pool.id)
    .eq("participant_id", participant.id)
    .eq("rules_version", version)
    .maybeSingle();
  if (!acceptance)
    return NextResponse.json(
      { error: "Aceite as Regras do Bolão antes de gerar o Pix." },
      { status: 403 },
    );

  const { data: existing } = await s
    .from("pagbank_sandbox_sessions")
    .select("qr_code_text,qr_code_url,expires_at")
    .eq("participant_id", participant.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.qr_code_text)
    return NextResponse.json({
      qrCodeText: existing.qr_code_text,
      qrCodeUrl: existing.qr_code_url,
      expiresAt: existing.expires_at,
      reused: true,
    });

  const amount = Number(participant.test_amount_cents || 100);
  const referenceId = `bolao-test-${participant.id}-${crypto.randomUUID().slice(0, 8)}`;
  const origin = new URL(request.url).origin;
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const response = await pagBankSandboxFetch("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({
      reference_id: referenceId,
      customer: {
        name: participant.name,
        email:
          participant.email ||
          `teste.${participant.id.slice(0, 8)}@sandbox.pagseguro.com`,
        // Dado fictício aceito exclusivamente no ambiente Sandbox do PagBank.
        tax_id: "12345678909",
      },
      items: [{ reference_id: participant.id, name: `Teste - ${pool.title}`, quantity: 1, unit_amount: amount }],
      qr_codes: [{ amount: { value: amount }, expiration_date: expiration }],
      notification_urls: [`${origin}/api/webhooks/pagbank/sandbox`],
    }),
  });
  const order = (await response.json().catch(() => null)) as PagBankOrder | null;
  const qr = order?.qr_codes?.[0];
  const qrUrl = qr?.links?.find(
    (link) => link.rel === "QRCODE.PNG" || link.media === "image/png",
  )?.href;
  if (!response.ok || !order?.id || !qr?.text) {
    const failure = order?.error_messages?.[0];
    const reason = [failure?.parameter_name, failure?.description]
      .filter(Boolean)
      .join(": ");
    return NextResponse.json(
      { error: reason || "O PagBank Sandbox não conseguiu gerar o QR Code." },
      { status: 502 },
    );
  }

  const { error } = await s.from("pagbank_sandbox_sessions").insert({
    pool_id: pool.id,
    participant_id: participant.id,
    reference_id: referenceId,
    provider_order_id: order.id,
    qr_code_id: qr.id,
    qr_code_text: qr.text,
    qr_code_url: qrUrl,
    amount_cents: amount,
    expires_at: qr.expiration_date || expiration,
  });
  if (error)
    return NextResponse.json(
      { error: "Não foi possível registrar a cobrança de teste. Aplique a atualização 0025 do banco." },
      { status: 500 },
    );

  return NextResponse.json({
    qrCodeText: qr.text,
    qrCodeUrl: qrUrl,
    expiresAt: qr.expiration_date || expiration,
  });
}
