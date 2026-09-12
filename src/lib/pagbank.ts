const sandboxUrl = "https://sandbox.api.pagseguro.com";
const productionUrl = "https://api.pagseguro.com";

export const pagBankBaseUrl = () =>
  process.env.PAGBANK_ENVIRONMENT === "production" ? productionUrl : sandboxUrl;

export const pagBankToken = () => process.env.PAGBANK_TOKEN?.trim() || "";

export async function fetchPagBank(path: string, init?: RequestInit) {
  const token = pagBankToken();
  if (!token) throw new Error("PAGBANK_NOT_CONFIGURED");
  return fetch(`${pagBankBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export function pagBankOrderPaid(order: Record<string, unknown>) {
  const charges = Array.isArray(order.charges) ? order.charges : [];
  return charges.some((charge) => {
    if (!charge || typeof charge !== "object") return false;
    const status = String((charge as Record<string, unknown>).status || "").toUpperCase();
    return status === "PAID";
  });
}
