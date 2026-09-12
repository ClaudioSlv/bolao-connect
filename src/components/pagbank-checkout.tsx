"use client";
import {useEffect,useState} from "react";

type Pix={qrCodeText:string;qrCodeImage:string;expiresAt?:string};
export function PagBankCheckout({token,amountLabel}:{token:string;amountLabel:string}){
  const[busy,setBusy]=useState(false),[pix,setPix]=useState<Pix|null>(null),[notice,setNotice]=useState("");
  async function create(){setBusy(true);setNotice("");try{const r=await fetch("/api/payments/pagbank/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})}),b=await r.json();if(!r.ok||!b.qrCodeText)throw new Error(b.error||"Não foi possível gerar o Pix.");setPix(b)}catch(e){setNotice(e instanceof Error?e.message:"Não foi possível gerar o Pix.")}finally{setBusy(false)}}
  async function copy(){if(!pix)return;try{await navigator.clipboard.writeText(pix.qrCodeText);setNotice("✓ Código Pix copiado. Abra o aplicativo do seu banco e cole para pagar.")}catch{setNotice("Não foi possível copiar automaticamente. Toque e segure o código abaixo.")}}
  useEffect(()=>{if(!pix)return;const check=async()=>{try{const r=await fetch("/api/payments/pagbank/status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})}),b=await r.json();if(b.paid){setNotice("✓ Pagamento confirmado! Atualizando sua cota...");setTimeout(()=>window.location.reload(),900)}}catch{}};check();const id=setInterval(check,5000);return()=>clearInterval(id)},[pix,token]);
  if(!pix)return <div className="pagbank-checkout"><button className="button primary payment-main-button" type="button" onClick={create} disabled={busy}>{busy?"Gerando QR Code...":`GERAR PIX PAGBANK · ${amountLabel}`}</button><p className="muted">O QR Code será gerado nesta tela e vinculado ao seu cadastro.</p>{notice&&<p className="status">{notice}</p>}</div>;
  return <div className="pagbank-checkout"><div className="pagbank-qr"><img src={pix.qrCodeImage} alt="QR Code Pix PagBank" width="280" height="280"/><strong>Escaneie ou use o Pix Copia e Cola</strong><span>{amountLabel}</span></div><button className="button primary" type="button" onClick={copy}>📋 COPIAR CÓDIGO PIX</button><textarea className="pagbank-pix-code" readOnly value={pix.qrCodeText} aria-label="Código Pix Copia e Cola"/><p className="muted">A confirmação será verificada automaticamente enquanto esta tela estiver aberta.</p>{notice&&<p className="status">{notice}</p>}</div>;
}
