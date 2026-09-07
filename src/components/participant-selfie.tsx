"use client";

import {useRef,useState} from "react";

export function ParticipantSelfie({token,consentText}:{token:string;consentText:string}){
  const input=useRef<HTMLInputElement>(null);
  const [preview,setPreview]=useState<string>("");
  return <div className="form">
    <div className="field"><label>Selfie de identificação</label><input ref={input} name="selfie" type="file" accept="image/jpeg,image/png,image/webp" capture="user" required onChange={(e)=>{const file=e.target.files?.[0];if(preview)URL.revokeObjectURL(preview);setPreview(file?URL.createObjectURL(file):"")}}/></div>
    {preview&&<img src={preview} alt="Prévia da selfie" style={{width:120,height:120,objectFit:"cover",borderRadius:"50%",border:"2px solid #2f8f55"}}/>}
    <label><input type="checkbox" name="selfieConsent" required/> {consentText}</label>
    <input type="hidden" name="token" value={token}/>
  </div>;
}
