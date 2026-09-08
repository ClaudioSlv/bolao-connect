"use client";
import {useEffect,useState} from "react";

function keyToBytes(value:string){
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

type Props={slug?:string;campaignKey?:string};

export function TimerReminderOptIn({slug,campaignKey}:Props){
  const[visible,setVisible]=useState(false);
  const[state,setState]=useState<"checking"|"idle"|"busy"|"ok"|"error">("checking");
  const identity=slug||campaignKey||"";
  const reminderText=campaignKey?"a abertura do próximo bolão":"a abertura dos pagamentos";

  useEffect(()=>{
    let cancelled=false;
    let timer:number|undefined;

    const checkExisting=async()=>{
      try{
        if(!identity||!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error();
        const reg=await navigator.serviceWorker.ready;
        const sub=await reg.pushManager.getSubscription();
        if(sub&&Notification.permission==="granted"){
          const res=await fetch("/api/push/timer-subscribe",{
            method:"POST",
            headers:{"content-type":"application/json"},
            body:JSON.stringify({slug,campaignKey,subscription:sub.toJSON()}),
          });
          if(res.ok&&!cancelled){setState("ok");setVisible(true);return;}
        }
      }catch{}

      if(!cancelled){
        setState("idle");
        timer=window.setTimeout(()=>setVisible(true),5000);
      }
    };

    checkExisting();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer)};
  },[identity,slug,campaignKey]);

  const enable=async()=>{
    try{
      setState("busy");
      if(!identity||!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error();
      const permission=await Notification.requestPermission();
      if(permission!=="granted")throw new Error();
      const reg=await navigator.serviceWorker.ready;
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if(!publicKey)throw new Error();
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyToBytes(publicKey)});
      const res=await fetch("/api/push/timer-subscribe",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({slug,campaignKey,subscription:sub.toJSON()}),
      });
      if(!res.ok)throw new Error();
      setState("ok");
    }catch{setState("error")}
  };

  if(!visible||state==="checking")return null;
  if(state==="ok")return <div className="section"><p className="status">🔔 LEMBRETES ATIVOS NESTE CELULAR · a cada 10 dias até {reminderText}</p></div>;

  return <div className="section">
    <h2>🔔 Quer ser lembrado?</h2>
    <p className="muted">Ative uma única vez neste celular. O Bolão Connect enviará um lembrete a cada 10 dias até {reminderText}.</p>
    <button className="button secondary" type="button" disabled={state==="busy"} onClick={enable}>{state==="busy"?"Ativando...":"Ativar lembretes neste celular"}</button>
    {state==="error"&&<p className="muted">Não foi possível ativar neste aparelho. Verifique se as notificações estão permitidas.</p>}
  </div>;
}
