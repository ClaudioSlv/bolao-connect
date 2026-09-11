"use client";
import {useState} from "react";

type Checkout={checkoutUrl:string;qrCode:string;reused?:boolean};

export function InfinitePayCheckout({token,amountLabel}:{token:string;amountLabel:string}){
  const[checkout,setCheckout]=useState<Checkout|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  async function generate(){setBusy(true);setNotice("");try{const res=await fetch("/api/payments/infinitepay/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});const body=await res.json();if(!res.ok)throw new Error(body.error||"Não foi possível gerar o pagamento.");setCheckout(body);setNotice("QR Code criado e vinculado ao seu cadastro.")}catch(e){setNotice(e instanceof Error?e.message:"Não foi possível gerar o pagamento.")}finally{setBusy(false)}}
  async function copy(){if(!checkout)return;try{await navigator.clipboard.writeText(checkout.checkoutUrl);setNotice("✅ Link do pagamento copiado. Abra o link para visualizar o Pix e copiar a chave na InfinitePay.")}catch{setNotice("Não foi possível copiar. Toque em Abrir pagamento.")}}
  if(!checkout)return <><button className="button primary" type="button" onClick={generate} disabled={busy}>{busy?"Gerando pagamento...":`GERAR PIX DE ${amountLabel}`}</button>{notice&&<p className="status" role="status">{notice}</p>}</>;
  return <div className="infinitepay-checkout"><div className="pix-qr-card"><img src={checkout.qrCode} width="236" height="236" alt="QR Code do pagamento InfinitePay"/><strong>Escaneie para abrir o pagamento</strong><span className="muted">Esta cobrança está vinculada somente ao seu cadastro.</span></div><div className="actions"><button className="button secondary" type="button" onClick={copy}>COPIAR LINK DO QR CODE</button><a className="button primary" href={checkout.checkoutUrl}>ABRIR PAGAMENTO</a></div>{notice&&<p className="status" role="status">{notice}</p>}<p className="muted">Depois do Pix, aguarde alguns segundos e atualize esta página. A confirmação é feita automaticamente pela InfinitePay.</p></div>;
}
