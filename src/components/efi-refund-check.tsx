"use client";
import {useState} from "react";

export function EfiRefundCheck({participantId}:{participantId:string}){
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [canRetry,setCanRetry]=useState(false);
  async function check(){
    setBusy(true);setMessage("");setCanRetry(false);
    try{
      const response=await fetch(`/api/admin/efi-refund-check?participantId=${encodeURIComponent(participantId)}`);
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Consulta indisponível.");
      setMessage(`Permissão pix.write: ${data.pixWrite===true?"ativa":data.pixWrite===false?"ausente":"não informada pela Efí"}. Devolução na Efí: ${data.bankStatus??data.bankError??`HTTP ${data.bankHttpStatus}`}. Registro no app: ${data.localStatus}.`);
      setCanRetry(data.pixWrite===true&&data.localStatus==="failed"&&data.bankHttpStatus===404);
    }catch(error){setMessage(error instanceof Error?error.message:"Consulta indisponível.");}
    finally{setBusy(false);}
  }
  async function retry(){
    setBusy(true);setCanRetry(false);setMessage("");
    try{
      const response=await fetch("/api/admin/efi-refund-retry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({participantId})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Tentativa indisponível.");
      setMessage(data.status==="completed"?"Devolução concluída na Efí.":data.status==="failed"?"A Efí recusou a nova tentativa. Confira o estorno novamente.":"Tentativa enviada; consulte a Efí novamente para confirmar a conclusão.");
    }catch(error){setMessage(error instanceof Error?error.message:"Tentativa indisponível.");}
    finally{setBusy(false);}
  }
  return <><button className="button secondary" type="button" disabled={busy} onClick={()=>void check()}>{busy?"CONSULTANDO EFÍ...":"VERIFICAR ESTORNO NA EFÍ"}</button>{canRetry&&<button className="button secondary" type="button" disabled={busy} onClick={()=>void retry()}>TENTAR ESTORNO NOVAMENTE</button>}{message&&<p className="status" role="status">{message}</p>}</>;
}
