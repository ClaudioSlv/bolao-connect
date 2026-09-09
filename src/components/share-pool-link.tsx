"use client";
import {useState} from "react";

export function SharePoolLink(){
 const[copied,setCopied]=useState(false);
 const url=typeof window!=="undefined"?`${window.location.origin}/bolao`:"";
 async function share(){
  const shareUrl=url||"https://bolao-connect.vercel.app/bolao";
  try{
   if(navigator.share){await navigator.share({title:"Bolão Amigos BTP",text:"🍀 Veja os bolões disponíveis e participe:",url:shareUrl});return}
   await navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),2500);
  }catch{}
 }
 async function copy(){
  const shareUrl=url||"https://bolao-connect.vercel.app/bolao";
  try{await navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),2500)}catch{}
 }
 return <div className="form">
  <button type="button" className="button primary" onClick={share}>📤 COMPARTILHAR BOLÃO</button>
  <button type="button" className="button secondary" onClick={copy}>{copied?"✅ LINK COPIADO":"🔗 COPIAR LINK"}</button>
 </div>;
}
