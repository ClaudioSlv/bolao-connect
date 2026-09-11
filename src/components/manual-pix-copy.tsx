"use client";

import {useState} from "react";

export function ManualPixCopy({pixKey,amountLabel}:{pixKey:string;amountLabel:string}){
  const[copied,setCopied]=useState(false);

  async function copyPixKey(){
    try{
      await navigator.clipboard.writeText(pixKey);
    }catch{
      const field=document.createElement("textarea");
      field.value=pixKey;
      field.style.position="fixed";
      field.style.opacity="0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    window.setTimeout(()=>setCopied(false),5000);
  }

  return <div className="manual-pix-copy">
    <button className="button secondary manual-pix-copy-button" type="button" onClick={copyPixKey}>
      {copied?"✓ CHAVE PIX COPIADA":"📋 COPIAR CHAVE PIX"}
    </button>
    {copied&&<p className="status" role="status">Abra seu banco, cole a chave Pix e pague {amountLabel}. Depois envie o comprovante abaixo.</p>}
  </div>;
}
