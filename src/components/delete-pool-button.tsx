"use client";

import {useState} from "react";
import {deletePool} from "@/app/actions/pools";

export function DeletePoolButton({poolId,poolTitle}:{poolId:string;poolTitle:string}){
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const closeConfirmation=()=>{setConfirming(false);setBusy(false);setError("");};

  if(!confirming)return <button type="button" className="button danger" onClick={()=>{setError("");setConfirming(true)}}>🗑️ Excluir bolão</button>;

  return <div className="card" style={{borderColor:"#b42318"}}>
    <strong>⚠️ Excluir “{poolTitle}”?</strong>
    <span>Esta ação é permanente e também remove os dados vinculados a este bolão. Use somente se tiver certeza.</span>
    {error&&<span className="status">{error}</span>}
    <div className="actions">
      <button type="button" className="button secondary" disabled={busy} onClick={closeConfirmation}>Cancelar</button>
      <button type="button" className="button danger" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await deletePool(poolId);closeConfirmation()}catch(e){const message=e instanceof Error?e.message:"Não foi possível excluir o bolão.";if(message.includes("NEXT_REDIRECT")){closeConfirmation();return}setError(message);setBusy(false)}}}>{busy?"Excluindo…":"Sim, excluir definitivamente"}</button>
    </div>
  </div>;
}
