"use client";
import {useEffect,useState} from "react";

function keyToBytes(value:string){const padding="=".repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}

export function ReminderOptIn({token}:{token:string}){
  const[visible,setVisible]=useState(false);
  const[state,setState]=useState<"idle"|"busy"|"ok"|"error">("idle");

  useEffect(()=>{
    const timer=window.setTimeout(()=>setVisible(true),5000);
    return()=>window.clearTimeout(timer);
  },[]);

  const enable=async()=>{
    try{
      setState("busy");
      if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error();
      const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error();
      const reg=await navigator.serviceWorker.ready;
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!publicKey)throw new Error();
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyToBytes(publicKey)});
      const res=await fetch("/api/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,subscription:sub.toJSON()})});
      if(!res.ok)throw new Error();setState("ok");
    }catch{setState("error")}
  };

  if(!visible)return null;
  if(state==="ok")return <p className="status">🔔 LEMBRETES ATIVADOS · a cada 10 dias até o pagamento</p>;
  return <div className="section"><h2>🔔 Não perca o prazo</h2><p className="muted">Quer receber um lembrete deste bolão no seu celular a cada 10 dias até o pagamento ser confirmado?</p><button className="button secondary" type="button" disabled={state==="busy"} onClick={enable}>{state==="busy"?"Ativando...":"Ativar lembretes a cada 10 dias"}</button>{state==="error"&&<p className="muted">Não foi possível ativar neste aparelho. Verifique se as notificações estão permitidas.</p>}</div>
}
