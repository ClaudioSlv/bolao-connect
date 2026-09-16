import { mkdir, writeFile } from "node:fs/promises";

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "preview") {
  console.log("[PagBank smoke] Ignorado fora do Preview.");
  process.exit(0);
}

const token =
  process.env.PAGBANK_SANDBOX_TOKEN?.trim() ||
  process.env.PAGBANK_TOKEN?.trim() ||
  "";

if (!token) {
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

const createResponse = await fetch(`${baseUrl}/orders`, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});
const createText = await createResponse.text();
let createJson = null;
try {
  createJson = JSON.parse(createText);
} catch {}

const orderId = String(createJson?.id || "");
const charge = Array.isArray(createJson?.charges) ? createJson.charges[0] : null;
const chargeStatus = String(charge?.status || "");
const qrText = String(charge?.qr_code?.text || "");

let consultResponse = null;
let consultText = "";
let consultJson = null;
if (orderId) {
  consultResponse = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  consultText = await consultResponse.text();
  try {
    consultJson = JSON.parse(consultText);
  } catch {}
}

const createPassed =
  createResponse.status === 201 &&
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
  `Status HTTP: ${createResponse.status} ${createResponse.statusText}`.trim(),
  `Status da cobrança: ${chargeStatus || "não retornado"}`,
  `QR Code retornado: ${qrText ? "SIM" : "NÃO"}`,
  `Resultado do teste: ${createPassed ? "APROVADO" : "REVISAR"}`,
  "Resposta recebida:",
  createJson ? pretty(createJson) : createText,
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

console.log(`[PagBank smoke] POST /orders: ${createResponse.status} | cobrança=${chargeStatus} | qr=${qrText ? "sim" : "não"}`);
console.log(`[PagBank smoke] GET /orders/{id}: ${consultResponse?.status || 0}`);
console.log(`[PagBank smoke] Resultado: ${passed ? "APROVADO" : "REVISAR"}`);

if (!passed) process.exit(1);
