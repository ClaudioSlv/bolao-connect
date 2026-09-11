"use client";

import { useState } from "react";

export function InfinitePayCheckout({
  token,
  amountLabel,
}: {
  token: string;
  amountLabel: string;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function pay() {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/payments/infinitepay/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        }),
        body = await res.json();
      if (!res.ok || !body.checkoutUrl)
        throw new Error(body.error || "Não foi possível abrir o pagamento.");
      window.location.assign(body.checkoutUrl);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Não foi possível abrir o pagamento.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="infinitepay-checkout">
      <button
        className="button primary payment-main-button"
        type="button"
        onClick={pay}
        disabled={busy}
      >
        {busy ? "Abrindo pagamento..." : `PAGAR AGORA COM PIX · ${amountLabel}`}
      </button>
      <p className="muted">
        Você será direcionado para a InfinitePay. Escolha Pix, copie o código e
        pague pelo aplicativo do seu banco.
      </p>
      {notice && (
        <p className="status" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
