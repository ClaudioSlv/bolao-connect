"use client";
import {useState} from "react";

export function TestEfiRefund({token}: {token:string}) {
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  async function requestRefund() {
    if(busy)return;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/test-efi-refund",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Falha ao consultar devolução.");
      setStatus(result.status);
    } catch(caught) {setError(caught instanceof Error?caught.message:"Tente novamente.");}
    finally {setBusy(false);}
  }
  return <section className="section">
    <h2>🧪 Teste de estorno Pix</h2>
    <p>Este pagamento de R$ 5,00 não ocupa cota. Ao solicitar o teste, a Efí devolverá R$ 4,85 à conta que pagou o QR Code. A retenção de teste é R$ 0,15.</p>
    <button className="button primary" type="button" disabled={busy||status==="completed"} onClick={()=>void requestRefund()}>{busy?"AGUARDE, CONSULTANDO A EFÍ":status?"ATUALIZAR STATUS DO ESTORNO":"TESTAR ESTORNO DE R$ 4,85"}</button>
    {status&&<p className="status" role="status">{status==="completed"?"Devolução confirmada pela Efí.":status==="processing"?"Devolução solicitada. Aguarde a confirmação da Efí.":"Estorno aguardando análise; não tente um segundo pagamento."}</p>}
    {error&&<p className="status" role="alert">{error}</p>}
  </section>;
}
