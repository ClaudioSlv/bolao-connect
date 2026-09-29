"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { maxInstallments } from "@/lib/payment-installments";

type Pix = { qrCodeText: string; qrCodeImage: string; amountCents?: number; creditUsedCents?: number };
type PaymentRequest = { paymentMode: "full" | "partial"; installmentCount?: number; installmentsToPay?: number; targetCents: number };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function EfiCheckout({ token, amountCents, creditCents, installmentAmounts = [], existingPlanCount, planTotalCents = amountCents }: {
  token: string;
  amountCents: number;
  creditCents: number;
  installmentAmounts?: number[];
  existingPlanCount?: number;
  planTotalCents?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<Pix | null>(null);
  const [notice, setNotice] = useState("");
  const [choosingMode, setChoosingMode] = useState(false);
  const [choosingCount, setChoosingCount] = useState(false);
  const [choosingUnits, setChoosingUnits] = useState(false);
  const [choosingCredit, setChoosingCredit] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [units, setUnits] = useState(1);
  const [pending, setPending] = useState<PaymentRequest | null>(null);
  const [confirmed, setConfirmed] = useState<{ paid: boolean; creditOnly: boolean } | null>(null);
  const walletMode = installmentAmounts.length > 0;
  const maximumInstallments = maxInstallments(planTotalCents);
  const selectedWalletAmount = useMemo(() => installmentAmounts.slice(0, units).reduce((sum, value) => sum + value, 0), [installmentAmounts, units]);

  function prepare(request: PaymentRequest) {
    setChoosingMode(false); setChoosingCount(false); setChoosingUnits(false); setPending(request);
    if (creditCents > 0) setChoosingCredit(true);
    else void create(request, false);
  }

  async function create(request: PaymentRequest, useCredit: boolean) {
    if (busy) return;
    setChoosingCredit(false); setBusy(true); setNotice("Aguarde, estamos preparando o pagamento...");
    try {
      const response = await fetch("/api/payments/efi/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, useCredit, paymentMode: request.paymentMode, installmentCount: request.installmentCount, installmentsToPay: request.installmentsToPay }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível gerar o Pix.");
      if (body.paymentConfirmed && body.creditOnly) {
        setConfirmed({ paid: Boolean(body.paid), creditOnly: true }); setNotice("");
        setTimeout(() => location.reload(), 2400); return;
      }
      if (body.paid && body.alreadyPaid) { location.reload(); return; }
      if (!body.qrCodeText) throw new Error("Não foi possível gerar o Pix.");
      setPix(body);
      setNotice(Number(body.creditUsedCents) > 0 ? `✓ Crédito de ${money(Number(body.creditUsedCents))} abatido. Pague somente o restante.` : "");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível gerar o Pix."); }
    finally { setBusy(false); }
  }

  function start() { if (walletMode) setChoosingUnits(true); else setChoosingMode(true); }
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
        if (!stopped && (body.paid || body.paymentConfirmed)) {
          setNotice(body.paid ? "✓ Cota quitada! Atualizando..." : "✓ Parcela confirmada! Atualizando sua carteira...");
          setTimeout(() => location.reload(), 1200);
        }
      } catch {}
    };
    void check(); const id = setInterval(check, 5000);
    return () => { stopped = true; clearInterval(id); };
  }, [token]);

  const closeAll = () => { setChoosingMode(false); setChoosingCount(false); setChoosingUnits(false); setChoosingCredit(false); };
  const modal = (content: ReactNode, titleId: string) => <div className="credit-choice-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="credit-choice-modal"><button className="credit-choice-close" type="button" onClick={closeAll} aria-label="Fechar">×</button>{content}</div></div>;

  return <div className="pagbank-checkout">
    {choosingMode && modal(<><div className="credit-choice-icon">💰</div><h2 id="payment-mode-title">Como deseja pagar?</h2><p>{existingPlanCount ? `Seu plano de ${existingPlanCount}x já está ativo.` : "Escolha o pagamento integral ou divida o valor em pagamentos parciais."}</p><button className="button primary" type="button" onClick={() => prepare({ paymentMode: "full", targetCents: amountCents })}>PAGAR TODO O SALDO</button>{existingPlanCount ? <button className="button secondary" type="button" onClick={() => { location.href=`/p/${token}/carteira`; }}>CONTINUAR PELAS PARCELAS</button> : <button className="button secondary" type="button" onClick={() => { setChoosingMode(false); setChoosingCount(true); }}>PAGAR A COTA PARCIAL</button>}</>, "payment-mode-title")}
    {choosingCount && modal(<><div className="credit-choice-icon">🗓️</div><h2 id="installment-count-title">Dividir em quantas vezes?</h2><p>Escolha de 2x a {maximumInstallments}x. A cota ficará pendente até a quitação total.</p><div className="installment-choice-grid">{Array.from({ length: maximumInstallments - 1 }, (_, index) => index + 2).map(count => <button key={count} type="button" className={installmentCount === count ? "active" : ""} onClick={() => setInstallmentCount(count)}>{count}x</button>)}</div><div className="credit-choice-values"><div><span>Primeiro pagamento</span><strong>{money(Math.floor(planTotalCents / installmentCount))}</strong></div><div><span>Total da cota</span><strong>{money(planTotalCents)}</strong></div></div><button className="button primary" type="button" onClick={() => prepare({ paymentMode: "partial", installmentCount, installmentsToPay: 1, targetCents: Math.floor(planTotalCents / installmentCount) })}>GERAR A 1ª PARCELA</button></>, "installment-count-title")}
    {choosingUnits && modal(<><div className="credit-choice-icon">🧾</div><h2 id="installment-units-title">Quantas parcelas deseja pagar?</h2><p>Você pode pagar uma ou várias parcelas juntas.</p><select className="installment-select" value={units} onChange={event => setUnits(Number(event.target.value))}>{installmentAmounts.map((_, index) => <option key={index + 1} value={index + 1}>{index + 1} parcela{index ? "s" : ""}</option>)}</select><div className="credit-choice-values"><div><span>Valor selecionado</span><strong>{money(selectedWalletAmount)}</strong></div><div><span>Saldo pendente</span><strong className="wallet-pending-text">{money(amountCents)}</strong></div></div><button className="button primary" type="button" onClick={() => prepare({ paymentMode: "partial", installmentsToPay: units, targetCents: selectedWalletAmount })}>CONTINUAR PAGAMENTO</button></>, "installment-units-title")}
    {choosingCredit && pending && modal(<><div className="credit-choice-icon">💳</div><h2 id="credit-choice-title">Usar crédito da carteira?</h2><p>Você pode abater o crédito do valor selecionado.</p><div className="credit-choice-values"><div><span>Crédito disponível</span><strong className="wallet-credit-text">{money(creditCents)}</strong></div><div><span>Valor selecionado</span><strong>{money(pending.targetCents)}</strong></div><div><span>Restante com crédito</span><strong>{money(Math.max(0, pending.targetCents - creditCents))}</strong></div></div><button className="button primary" type="button" onClick={() => void create(pending, true)}>SIM, USAR MEU CRÉDITO</button><button className="button secondary" type="button" onClick={() => void create(pending, false)}>NÃO, PAGAR SEM CRÉDITO</button></>, "credit-choice-title")}
    {confirmed && modal(<><div className="credit-paid-check">✓</div><h2 id="payment-confirmed-title">{confirmed.paid ? "Cota paga com sucesso!" : "Parcela paga com sucesso!"}</h2><p>{confirmed.paid ? "Sua cota foi totalmente quitada." : "O crédito foi registrado e o saldo pendente foi atualizado."}</p><strong className="wallet-paid-text">Pagamento confirmado</strong></>, "payment-confirmed-title")}
    {!pix ? <><button className="button primary payment-main-button payment-pulse" type="button" onClick={start} disabled={busy}>{busy ? "AGUARDE, ESTAMOS PREPARANDO O PAGAMENTO..." : walletMode ? "PAGAR PARCELAS" : "PAGUE A SUA COTA AQUI"}</button><p className="muted">{walletMode ? "Selecione quantas parcelas deseja pagar agora." : `Escolha pagamento integral ou parcial de 2x a ${maximumInstallments}x.`}</p>{notice && <p className="status">{notice}</p>}</> : <><div className="pagbank-qr"><img src={pix.qrCodeImage} alt="QR Code Pix Efí" width="280" height="280"/><strong>Escaneie ou use o Pix Copia e Cola</strong><span>{money(Number(pix.amountCents ?? amountCents))}</span></div><button className="button primary" type="button" onClick={copy}>📋 COPIAR CÓDIGO PIX</button><textarea className="pagbank-pix-code" readOnly value={pix.qrCodeText}/><p className="muted">A confirmação será verificada automaticamente.</p>{notice && <p className="status">{notice}</p>}</>}
  </div>;
}
