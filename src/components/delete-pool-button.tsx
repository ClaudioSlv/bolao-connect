"use client";

import {useState} from "react";
import {deletePool} from "@/app/actions/pools";

export function DeletePoolButton({poolId,poolTitle}:{poolId:string;poolTitle:string}){
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  if(!confirming)return <button type="button" className="button danger" onClick={()=>setConfirming(true)}>🗑️ Excluir bolão</button>;

  return <div className="card" style={{borderColor:"#b42318"}}>
    <strong>⚠️ Excluir “{poolTitle}”?</strong>
    <span>Esta ação é permanente e também remove os dados vinculados a este bolão. Use somente se tiver certeza.</span>
    {error&&<span className="status">{error}</span>}
    <div className="actions">
      <button type="button" className="button secondary" disabled={busy} onClick={()=>setConfirming(false)}>Cancelar</button>
      <button type="button" className="button danger" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await deletePool(poolId)}catch(e){setError(e instanceof Error?e.message:"Não foi possível excluir o bolão.");setBusy(false)}}}>{busy?"Excluindo…":"Sim, excluir definitivamente"}</button>
    </div>
  </div>;
}
