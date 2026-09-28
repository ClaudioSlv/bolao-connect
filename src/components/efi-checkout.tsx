"use client";

import { useEffect, useState } from "react";

type Pix = { qrCodeText: string; qrCodeImage: string; expiresAt?: string; amountCents?: number; creditUsedCents?: number };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function EfiCheckout({ token, amountCents, creditCents }: { token: string; amountCents: number; creditCents: number }) {
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<Pix | null>(null);
  const [notice, setNotice] = useState("");
  const [choosingCredit, setChoosingCredit] = useState(false);
  const [paidWithCredit, setPaidWithCredit] = useState(false);
  const usableCredit = Math.min(amountCents, Math.max(0, creditCents));

  async function create(useCredit: boolean) {
    if (busy) return;
    setChoosingCredit(false);
    setBusy(true);
    setNotice("Aguarde, estamos preparando o pagamento...");
    try {
      const response = await fetch("/api/payments/efi/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, useCredit }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível gerar o Pix.");
      if (body.paid && body.creditOnly) {
        setPaidWithCredit(true);
        setNotice("");
        setTimeout(() => location.reload(), 2200);
        return;
      }
      if (!body.qrCodeText) throw new Error("Não foi possível gerar o Pix.");
      setPix(body);
      setNotice(Number(body.creditUsedCents) > 0 ? `✓ Crédito de ${money(Number(body.creditUsedCents))} utilizado. Pague somente o restante.` : "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível gerar o Pix.");
    } finally {
      setBusy(false);
    }
  }

  function startPayment() { if (usableCredit > 0) setChoosingCredit(true); else void create(false); }
  async function copy() {
    if (!pix) return;
    try { await navigator.clipboard.writeText(pix.qrCodeText); setNotice("✓ Código Pix copiado. Abra o aplicativo do seu banco e cole para pagar."); }
    catch { setNotice("Toque e segure o código abaixo para copiar."); }
  }

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch("/api/payments/efi/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
        const body = await response.json();
        if (!stopped && body.paid) { setNotice("✓ Pagamento confirmado! Atualizando sua cota..."); setTimeout(() => location.reload(), 900); }
      } catch {}
    };
    void check();
    const id = setInterval(check, 5000);
    return () => { stopped = true; clearInterval(id); };
  }, [token]);

  return <div className="pagbank-checkout">
    {choosingCredit && <div className="credit-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="credit-choice-title"><div className="credit-choice-modal">
      <button className="credit-choice-close" type="button" onClick={() => setChoosingCredit(false)} aria-label="Fechar">×</button>
      <div className="credit-choice-icon">💳</div><h2 id="credit-choice-title">Usar crédito da carteira?</h2>
      <p>Você tem crédito disponível e pode utilizá-lo para abater o valor desta cota.</p>
      <div className="credit-choice-values"><div><span>Crédito disponível</span><strong className="wallet-credit-text">{money(creditCents)}</strong></div><div><span>Valor da cota</span><strong>{money(amountCents)}</strong></div><div><span>Restante com crédito</span><strong>{money(Math.max(0, amountCents - usableCredit))}</strong></div></div>
      <button className="button primary" type="button" onClick={() => void create(true)}>SIM, USAR MEU CRÉDITO</button>
      <button className="button secondary" type="button" onClick={() => void create(false)}>NÃO, PAGAR VALOR INTEGRAL</button>
    </div></div>}
    {paidWithCredit && <div className="credit-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="credit-paid-title"><div className="credit-choice-modal credit-paid-modal">
      <div className="credit-paid-check">✓</div><h2 id="credit-paid-title">Cota paga com sucesso!</h2><p>Sua cota foi quitada utilizando o crédito disponível na carteira.</p><strong className="wallet-paid-text">Pagamento confirmado</strong>
    </div></div>}
    {!pix ? <><button className="button primary payment-main-button payment-pulse" type="button" onClick={startPayment} disabled={busy}>{busy ? "AGUARDE, ESTAMOS PREPARANDO O PAGAMENTO..." : "PAGUE A SUA COTA AQUI"}</button><p className="muted">Ao tocar no botão, você poderá escolher se deseja usar o crédito disponível.</p>{notice && <p className="status">{notice}</p>}</> : <>
      <div className="pagbank-qr"><img src={pix.qrCodeImage} alt="QR Code Pix Efí" width="280" height="280"/><strong>Escaneie ou use o Pix Copia e Cola</strong><span>{money(Number(pix.amountCents ?? amountCents))}</span></div>
      <button className="button primary" type="button" onClick={copy}>📋 COPIAR CÓDIGO PIX</button><textarea className="pagbank-pix-code" readOnly value={pix.qrCodeText}/><p className="muted">A confirmação será verificada automaticamente.</p>{notice && <p className="status">{notice}</p>}
    </>}
  </div>;
}
