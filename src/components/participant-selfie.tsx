"use client";

import {useEffect,useRef,useState} from "react";

const MAX_SIDE=1280;
const JPEG_QUALITY=0.78;

async function optimizeSelfie(file:File):Promise<File>{
  if(!file.type.startsWith("image/"))return file;
  try{
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale));
    const height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d");
    if(!ctx){bitmap.close();return file;}
    ctx.drawImage(bitmap,0,0,width,height);bitmap.close();
    const blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,"image/jpeg",JPEG_QUALITY));
    if(!blob)return file;
    return new File([blob],"selfie.jpg",{type:"image/jpeg",lastModified:Date.now()});
  }catch{
    return file;
  }
}

export function ParticipantSelfie({token,consentText}:{token:string;consentText:string}){
  const input=useRef<HTMLInputElement>(null);
  const [preview,setPreview]=useState<string>("");
  const [processing,setProcessing]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
  return <div className="form">
    <div className="field"><label>Selfie de identificação</label><input ref={input} name="selfie" type="file" accept="image/*" capture="user" required onChange={async(e)=>{const original=e.target.files?.[0];setError("");if(!original)return;setProcessing(true);try{const file=await optimizeSelfie(original);if(file.size>5*1024*1024)throw new Error("size");if(preview)URL.revokeObjectURL(preview);setPreview(URL.createObjectURL(file));}catch{setError("A foto ficou muito grande. Tente novamente ou escolha uma foto da galeria.");}finally{setProcessing(false)}}}/><span className="muted">Toque em “Escolher arquivo” para abrir a câmera frontal ou selecionar uma foto da galeria.</span></div>
    {processing&&<p className="muted">Preparando a foto para envio…</p>}
    {error&&<p className="status">{error}</p>}
    {preview&&<img src={preview} alt="Prévia da selfie" style={{width:120,height:120,objectFit:"cover",borderRadius:"50%",border:"2px solid #2f8f55"}}/>}
    <label><input type="checkbox" name="selfieConsent" required/> {consentText}</label>
    <input type="hidden" name="token" value={token}/>
  </div>;
}
