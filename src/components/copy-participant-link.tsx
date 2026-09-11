"use client";
import {useState} from "react";
import {PushTestButton} from "@/components/push-test-button";
export function CopyParticipantLink({token}:{token:string}){const[copied,setCopied]=useState(false);const copy=async()=>{const url=`${window.location.origin}/p/${token}`;try{await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{window.prompt("Copie o link do participante:",url)}};return <><button className="button secondary" type="button" onClick={copy}>{copied?"✓ LINK COPIADO":"🔗 LINK DO PARTICIPANTE"}</button><PushTestButton token={token}/></>}
