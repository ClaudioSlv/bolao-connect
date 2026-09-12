"use client";

import { useState } from "react";

type Charge = { qrCodeText: string; qrCodeUrl?: string; expiresAt?: string };

export function PagBankSandboxCheckout({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [charge, setCharge] = useState<Charge | null>(null);

  async function createCharge() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/payments/pagbank/sandbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json();
      if (!response.ok || !body.qrCodeText)
        throw new Error(body.error || "Não foi possível gerar o Pix de teste.");
      setCharge(body);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar o Pix de teste.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    if (!charge?.qrCodeText) return;
    await navigator.clipboard.writeText(charge.qrCodeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="pagbank-sandbox-checkout">
      {!charge ? (
        <button className="button primary payment-main-button" type="button" onClick={createCharge} disabled={busy}>
          {busy ? "GERANDO QR CODE..." : "GERAR PIX DE TESTE · PAGBANK"}
        </button>
      ) : (
        <div className="card pagbank-qr-card">
          <strong>QR Code Pix — ambiente de teste</strong>
          {charge.qrCodeUrl && <img className="pagbank-qr-image" src={charge.qrCodeUrl} alt="QR Code Pix de teste PagBank" />}
          <button className="button primary" type="button" onClick={copyPix}>
            {copied ? "PIX COPIADO ✓" : "COPIAR PIX COPIA E COLA"}
          </button>
          {charge.expiresAt && (
            <span className="muted">Válido até {new Date(charge.expiresAt).toLocaleString("pt-BR")}</span>
          )}
          <span className="muted">Sandbox: nenhum dinheiro real será transferido.</span>
        </div>
      )}
      {notice && <p className="status" role="status">{notice}</p>}
    </div>
  );
}

