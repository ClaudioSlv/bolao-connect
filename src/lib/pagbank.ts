const sandboxUrl = "https://sandbox.api.pagseguro.com";
const productionUrl = "https://api.pagseguro.com";

export const pagBankBaseUrl = () =>
  process.env.PAGBANK_ENVIRONMENT === "production" ? productionUrl : sandboxUrl;

export const pagBankToken = () => {
  const environment = process.env.PAGBANK_ENVIRONMENT?.trim().toLowerCase();
  if (environment !== "production") {
    return (
      process.env.PAGBANK_SANDBOX_TOKEN?.trim() ||
      process.env.PAGBANK_TOKEN?.trim() ||
      ""
    );
  }
  return process.env.PAGBANK_TOKEN?.trim() || "";
};

type AnyRecord = Record<string, any>;

function migrateLegacyPixOrderBody(path: string, init?: RequestInit) {
  if (path !== "/orders" || String(init?.method || "GET").toUpperCase() !== "POST")
    return { init, migratedLegacyPix: false };
  if (typeof init?.body !== "string") return { init, migratedLegacyPix: false };

  try {
    const payload = JSON.parse(init.body) as AnyRecord;
    if (Array.isArray(payload.charges) || !Array.isArray(payload.qr_codes))
      return { init, migratedLegacyPix: false };

    const legacyQr = payload.qr_codes[0] as AnyRecord | undefined;
    const amountValue = Number(legacyQr?.amount?.value || 0);
    if (!amountValue) return { init, migratedLegacyPix: false };

    const description = String(payload.items?.[0]?.name || "Pagamento Pix");
    const referenceId = String(payload.reference_id || crypto.randomUUID());

    payload.charges = [
      {
        reference_id: `${referenceId}-pix`,
        description,
        amount: { value: amountValue, currency: "BRL" },
        payment_method: {
          type: "PIX",
          pix: {
            ...(legacyQr?.expiration_date
              ? { expiration_date: legacyQr.expiration_date }
              : {}),
          },
        },
      },
    ];
    delete payload.qr_codes;

    return {
      migratedLegacyPix: true,
      init: { ...init, body: JSON.stringify(payload) },
    };
  } catch {
    return { init, migratedLegacyPix: false };
  }
}

async function addLegacyQrAlias(response: Response, shouldAlias: boolean) {
  if (!shouldAlias) return response;
  const text = await response.text();
  let parsed: AnyRecord | null = null;
  try {
    parsed = JSON.parse(text) as AnyRecord;
  } catch {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const charge = Array.isArray(parsed?.charges) ? parsed!.charges[0] : null;
  const qr = charge?.qr_code;
  if (qr?.text) {
    parsed!.qr_codes = [
      {
        id: qr.id,
        text: qr.text,
        expiration_date: charge?.payment_method?.pix?.expiration_date,
      },
    ];
  }

  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(parsed), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function fetchPagBank(path: string, init?: RequestInit) {
  const token = pagBankToken();
  if (!token) throw new Error("PAGBANK_NOT_CONFIGURED");

  const migrated = migrateLegacyPixOrderBody(path, init);
  const response = await fetch(`${pagBankBaseUrl()}${path}`, {
    ...migrated.init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(migrated.init?.body ? { "content-type": "application/json" } : {}),
      ...migrated.init?.headers,
    },
  });

  return addLegacyQrAlias(response, migrated.migratedLegacyPix);
}

export function pagBankOrderPaid(order: Record<string, unknown>) {
  const charges = Array.isArray(order.charges) ? order.charges : [];
  return charges.some((charge) => {
    if (!charge || typeof charge !== "object") return false;
    const status = String((charge as Record<string, unknown>).status || "").toUpperCase();
    return status === "PAID";
  });
}
