import { NextResponse } from "next/server";
import { fetchPagBank } from "@/lib/pagbank";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const environment = process.env.PAGBANK_ENVIRONMENT?.trim().toLowerCase();
  if (environment === "production")
    return NextResponse.json({ error: "sandbox_only" }, { status: 409 });

  const url = new URL(request.url);
  const referenceId = `smoke-v2-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
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
        reference_id: "smoke-item-001",
        name: "Teste Pix V2 Bolao Amigos BTP",
        quantity: 1,
        unit_amount: 100,
      },
    ],
    charges: [
      {
        reference_id: `${referenceId}-pix`,
        description: "Teste Pix V2 Bolao Amigos BTP",
        amount: { value: 100, currency: "BRL" },
        payment_method: {
          type: "PIX",
          pix: { expiration_date: expiration },
        },
      },
    ],
    notification_urls: [`${url.origin}/api/webhooks/pagbank`],
  };

  const created = await fetchPagBank("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": referenceId },
    body: JSON.stringify(payload),
  });
  const createBody = (await created.json().catch(() => null)) as Record<string, any> | null;
  const orderId = String(createBody?.id || "");
  const charge = Array.isArray(createBody?.charges) ? createBody!.charges[0] : null;
  const qrText = String(charge?.qr_code?.text || "");

  let consultStatus = 0;
  let consultBody: Record<string, any> | null = null;
  if (orderId) {
    const consulted = await fetchPagBank(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
    consultStatus = consulted.status;
    consultBody = (await consulted.json().catch(() => null)) as Record<string, any> | null;
  }

  return NextResponse.json({
    environment: environment || "sandbox",
    request: payload,
    create: {
      status: created.status,
      orderId,
      chargeStatus: String(charge?.status || ""),
      qrCodeReturned: Boolean(qrText),
      response: createBody,
    },
    consult: { status: consultStatus, response: consultBody },
    passed:
      created.ok &&
      Boolean(orderId) &&
      Boolean(qrText) &&
      String(charge?.status || "") === "WAITING" &&
      consultStatus === 200,
  });
}
