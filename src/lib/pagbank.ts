import "server-only";

export const PAGBANK_SANDBOX_API = "https://sandbox.api.pagseguro.com";

export function pagBankSandboxToken() {
  const token = process.env.PAGBANK_SANDBOX_TOKEN;
  if (!token) throw new Error("PagBank Sandbox não está configurado.");
  return token;
}

export async function pagBankSandboxFetch(path: string, init?: RequestInit) {
  return fetch(`${PAGBANK_SANDBOX_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${pagBankSandboxToken()}`,
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
}

