"use client";
import {useState} from "react";

export function EfiRefundCheck({participantId}:{participantId:string}){
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function check(){
    setBusy(true);setMessage("");
    try{
      const response=await fetch(`/api/admin/efi-refund-check?participantId=${encodeURIComponent(participantId)}`);
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Consulta indisponível.");
      setMessage(`Permissão pix.write: ${data.pixWrite===true?"ativa":data.pixWrite===false?"ausente":"não informada pela Efí"}. Devolução na Efí: ${data.bankStatus??data.bankError??`HTTP ${data.bankHttpStatus}`}. Registro no app: ${data.localStatus}.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Consulta indisponível.");}
    finally{setBusy(false);}
  }
  return <><button className="button secondary" type="button" disabled={busy} onClick={()=>void check()}>{busy?"CONSULTANDO EFÍ...":"VERIFICAR ESTORNO NA EFÍ"}</button>{message&&<p className="status" role="status">{message}</p>}</>;
}
