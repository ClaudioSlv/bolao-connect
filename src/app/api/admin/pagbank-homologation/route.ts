import { NextResponse } from "next/server";
import { fetchPagBank } from "@/lib/pagbank";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function safeResponse(text: string) {
  const parsed = parseJson(text);
  return parsed ? pretty(parsed) : text;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json(
      { error: "Entre como organizador para gerar o arquivo." },
      { status: 401 },
    );

  const environment = process.env.PAGBANK_ENVIRONMENT?.trim().toLowerCase();
  if (environment === "production")
    return NextResponse.json(
      {
        error:
          "Teste bloqueado: altere o PagBank para Sandbox antes de gerar a homologação.",
      },
      { status: 409 },
    );

  const origin = new URL(request.url).origin;
  const referenceId = `homologacao-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const notificationUrl = `${origin}/api/webhooks/pagbank`;
  const payload = {
    reference_id: referenceId,
    customer: {
      name: "Jose da Silva",
      email: "jose.silva@example.com",
      tax_id: "12345678909",
      phones: [
        {
          country: "55",
          area: "11",
          number: "999999999",
          type: "MOBILE",
        },
      ],
    },
    items: [
      {
        reference_id: "cota-homologacao-001",
        name: "Teste Homologacao Bolao Amigos BTP",
        quantity: 1,
        unit_amount: 100,
      },
    ],
    qr_codes: [{ amount: { value: 100 }, expiration_date: expiration }],
    notification_urls: [notificationUrl],
  };

  const createResponse = await fetchPagBank("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": referenceId },
    body: JSON.stringify(payload),
  });
  const createText = await createResponse.text();
  const createResult = parseJson(createText);
  const orderId = String(createResult?.id || "");

  let consultStatus = "NÃO EXECUTADO";
  let consultText =
    "A consulta não foi executada porque a criação não retornou o ID do pedido.";
  if (orderId) {
    const consultResponse = await fetchPagBank(
      `/orders/${encodeURIComponent(orderId)}`,
      { method: "GET" },
    );
    consultStatus = `${consultResponse.status} ${consultResponse.statusText}`.trim();
    consultText = await consultResponse.text();
  }

  const generatedAt = new Date().toISOString();
  const report = [
    "HOMOLOGAÇÃO PAGBANK — BOLÃO AMIGOS BTP",
    "Chamado PagBank: 444486651",
    `Gerado em: ${generatedAt}`,
    "Ambiente: Sandbox",
    "Valor do teste: R$ 1,00",
    "",
    "IMPORTANTE: o token de autenticação foi ocultado deste arquivo.",
    "",
    "============================================================",
    "TESTE 1 — CRIAR PEDIDO COM QR CODE PIX",
    "============================================================",
    "Método: POST",
    "URL: https://sandbox.api.pagseguro.com/orders",
    "Headers:",
    pretty({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer [TOKEN OCULTO]",
      "x-idempotency-key": referenceId,
    }),
    "",
    "Payload enviado:",
    pretty(payload),
    "",
    `Status HTTP: ${createResponse.status} ${createResponse.statusText}`.trim(),
    "Resposta recebida:",
    safeResponse(createText),
    "",
    "============================================================",
    "TESTE 2 — CONSULTAR PEDIDO",
    "============================================================",
    "Método: GET",
    `URL: https://sandbox.api.pagseguro.com/orders/${orderId || "{ID_DO_PEDIDO}"}`,
    "Headers:",
    pretty({
      Accept: "application/json",
      Authorization: "Bearer [TOKEN OCULTO]",
    }),
    "",
    `Status HTTP: ${consultStatus}`,
    "Resposta recebida:",
    safeResponse(consultText),
    "",
    "============================================================",
    "WEBHOOK CONFIGURADO",
    "============================================================",
    `URL de notificação: ${notificationUrl}`,
    "O webhook recebe as atualizações enviadas pelo PagBank.",
    "",
    "FIM DO ARQUIVO",
  ].join("\n");

  const date = generatedAt.slice(0, 10);
  return new NextResponse(report, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename=homologacao-pagbank-${date}.txt`,
      "cache-control": "no-store",
    },
  });
}
