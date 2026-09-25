import { NextResponse } from "next/server";
import { efiRequest } from "@/lib/efi";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const key = process.env.EFI_PIX_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Chave Pix Efí não configurada." }, { status: 500 });

  const response = await efiRequest(`/v2/webhook/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "x-skip-mtls-checking": "true" },
    body: { webhookUrl: "https://bolao-connect.vercel.app/api/payments/efi/webhook?ignorar=" },
  });

  return NextResponse.json({ ok: response.status >= 200 && response.status < 300, status: response.status, data: response.data }, { status: response.status >= 200 && response.status < 300 ? 200 : 502 });
}
