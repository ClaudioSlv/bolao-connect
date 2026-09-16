import { mkdir, writeFile } from "node:fs/promises";

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "preview") {
  console.log("[PagBank smoke] Ignorado fora do Preview.");
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

async function persistDiagnostics(message, details) {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/app_error_logs`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        source: "PagBank Sandbox Smoke PIX V2",
        message,
        details,
      }),
    });
  } catch {}
}

const token =
  process.env.PAGBANK_SANDBOX_TOKEN?.trim() ||
  process.env.PAGBANK_TOKEN?.trim() ||
  "";

if (!token) {
  await persistDiagnostics("Token Sandbox não configurado no Preview.", {
    pagbank_sandbox_token_present: Boolean(process.env.PAGBANK_SANDBOX_TOKEN),
    pagbank_token_present: Boolean(process.env.PAGBANK_TOKEN),
    vercel_env: process.env.VERCEL_ENV || null,
  });
  console.error("[PagBank smoke] Token Sandbox não configurado no Preview.");
  process.exit(1);
}

const baseUrl = "https://sandbox.api.pagseguro.com";
const referenceId = `homologacao-v2-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const notificationUrl = "https://bolao-connect.vercel.app/api/webhooks/pagbank";

const payload = {
  reference_id: referenceId,
  customer: {
    name: "Jose da Silva",
    email: "jose.silva@example.com",
    tax_id: "12345678909",
    phones: [
      { country: "55", area: "11", number: "999999999", type: "MOBILE" },
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
  charges: [
    {
      reference_id: `${referenceId}-pix`,
      description: "Teste Homologacao Bolao Amigos BTP",
      amount: { value: 100, currency: "BRL" },
      payment_method: {
        type: "PIX",
        pix: { expiration_date: expiration },
      },
    },
  ],
  notification_urls: [notificationUrl],
};

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "x-idempotency-key": referenceId,
};

let createResponse;
let createText = "";
let createJson = null;
let networkError = "";
try {
  createResponse = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  createText = await createResponse.text();
  try {
    createJson = JSON.parse(createText);
  } catch {}
} catch (error) {
  networkError = error instanceof Error ? error.message : String(error);
}

const orderId = String(createJson?.id || "");
const charge = Array.isArray(createJson?.charges) ? createJson.charges[0] : null;
const chargeStatus = String(charge?.status || "");
const qrText = String(charge?.qr_code?.text || "");

let consultResponse = null;
let consultText = "";
let consultJson = null;
if (orderId) {
  try {
    consultResponse = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    consultText = await consultResponse.text();
    try {
      consultJson = JSON.parse(consultText);
    } catch {}
  } catch (error) {
    consultText = error instanceof Error ? error.message : String(error);
  }
}

const createPassed =
  createResponse?.status === 201 &&
  Boolean(orderId) &&
  chargeStatus === "WAITING" &&
  Boolean(qrText);
const consultPassed = consultResponse?.status === 200 && Boolean(consultJson?.id);
const passed = createPassed && consultPassed;
const generatedAt = new Date().toISOString();

const pretty = (value) => JSON.stringify(value, null, 2);
const report = [
  "HOMOLOGAÇÃO PAGBANK — BOLÃO AMIGOS BTP",
  "Integração: API Orders — PIX V2",
  `Gerado em: ${generatedAt}`,
  "Ambiente: Sandbox",
  "Valor do teste: R$ 1,00",
  `Resultado geral: ${passed ? "APROVADO" : "REVISAR"}`,
  "",
  "IMPORTANTE: o token de autenticação foi ocultado deste arquivo.",
  "",
  "============================================================",
  "TESTE 1 — CRIAR PEDIDO COM PIX V2",
  "============================================================",
  "Método: POST",
  `URL: ${baseUrl}/orders`,
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
  `Status HTTP: ${createResponse ? `${createResponse.status} ${createResponse.statusText}`.trim() : "NÃO EXECUTADO"}`,
  `Erro de rede: ${networkError || "nenhum"}`,
  `Status da cobrança: ${chargeStatus || "não retornado"}`,
  `QR Code retornado: ${qrText ? "SIM" : "NÃO"}`,
  `Resultado do teste: ${createPassed ? "APROVADO" : "REVISAR"}`,
  "Resposta recebida:",
  createJson ? pretty(createJson) : createText || networkError || "Sem resposta.",
  "",
  "============================================================",
  "TESTE 2 — CONSULTAR PEDIDO",
  "============================================================",
  "Método: GET",
  `URL: ${baseUrl}/orders/${orderId || "{ID_DO_PEDIDO}"}`,
  "Headers:",
  pretty({ Accept: "application/json", Authorization: "Bearer [TOKEN OCULTO]" }),
  "",
  `Status HTTP: ${consultResponse ? `${consultResponse.status} ${consultResponse.statusText}`.trim() : "NÃO EXECUTADO"}`,
  `Resultado do teste: ${consultPassed ? "APROVADO" : "REVISAR"}`,
  "Resposta recebida:",
  consultJson ? pretty(consultJson) : consultText || "Consulta não executada.",
  "",
  "============================================================",
  "WEBHOOK CONFIGURADO",
  "============================================================",
  `URL de notificação: ${notificationUrl}`,
  "",
  "FIM DO ARQUIVO",
].join("\n");

await mkdir("public", { recursive: true });
await writeFile("public/homologacao-pagbank-pix-v2.txt", `\uFEFF${report}`, "utf8");

await persistDiagnostics(passed ? "APROVADO" : "REVISAR", {
  generated_at: generatedAt,
  request_payload: payload,
  create_http_status: createResponse?.status || 0,
  create_status_text: createResponse?.statusText || "",
  network_error: networkError,
  create_response: createJson || createText,
  order_id: orderId,
  charge_status: chargeStatus,
  qr_code_returned: Boolean(qrText),
  consult_http_status: consultResponse?.status || 0,
  consult_response: consultJson || consultText,
  passed,
});

console.log(`[PagBank smoke] POST /orders: ${createResponse?.status || 0} | cobrança=${chargeStatus} | qr=${qrText ? "sim" : "não"}`);
console.log(`[PagBank smoke] GET /orders/{id}: ${consultResponse?.status || 0}`);
console.log(`[PagBank smoke] Resultado: ${passed ? "APROVADO" : "REVISAR"}`);

if (!passed) process.exit(1);
