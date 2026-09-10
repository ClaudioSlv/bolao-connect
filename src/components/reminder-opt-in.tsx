"use client";
import {useEffect,useState} from "react";

function keyToBytes(value:string){const padding="=".repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}

export function ReminderOptIn({token,paid=false}:{token:string;paid?:boolean}){
  const[visible,setVisible]=useState(false);
  const[state,setState]=useState<"checking"|"idle"|"busy"|"ok"|"error">("checking");

  useEffect(()=>{
    let cancelled=false;
    let timer:number|undefined;
    const checkExisting=async()=>{
      try{
        if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error();
        const reg=await navigator.serviceWorker.ready;
        const sub=await reg.pushManager.getSubscription();
        if(sub&&Notification.permission==="granted"){
          const res=await fetch("/api/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,subscription:sub.toJSON()})});
          if(res.ok&&!cancelled){setState("ok");setVisible(true);return;}
        }
      }catch{}
      if(!cancelled){setState("idle");timer=window.setTimeout(()=>setVisible(true),paid?800:5000)}
    };
    checkExisting();return()=>{cancelled=true;if(timer)window.clearTimeout(timer)};
  },[token,paid]);

  const enable=async()=>{
    try{
      setState("busy");
      if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error();
      const permission=await Notification.requestPermission();
      if(permission!=="granted")throw new Error();
      const reg=await navigator.serviceWorker.ready;
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if(!publicKey)throw new Error();
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyToBytes(publicKey)});
      const res=await fetch("/api/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,subscription:sub.toJSON()})});
      if(!res.ok)throw new Error();
      setState("ok");
      setVisible(true);
    }catch{
      setState("error");
      setVisible(true);
    }
  };

  if(!visible||state==="checking")return null;
  if(state==="ok")return <div className="section"><h2>🔔 Notificações do bolão</h2><p className="status" style={{color:"#22c55e",fontWeight:800,fontSize:"1.15rem"}}>✅ NOTIFICAÇÃO ATIVA</p><p className="muted">{paid?"Você receberá avisos dos jogos, resultados, prêmios, créditos e novidades deste bolão. Como sua cota está quitada, não receberá lembretes de pagamento.":"Você receberá avisos deste bolão e lembretes de pagamento enquanto houver valor pendente."}</p></div>;
  return <div className="section"><h2>🔔 Notificações do bolão</h2><p className="muted">{paid?"Sua cota já está quitada. Ative as notificações para receber avisos dos jogos, resultados, prêmios, créditos e outras novidades do bolão. Você não receberá lembretes de pagamento.":"Ative as notificações para receber avisos deste bolão e lembretes enquanto seu pagamento estiver pendente."}</p><button className="button secondary" type="button" disabled={state==="busy"} onClick={enable}>{state==="busy"?"Ativando...":"🔔 ATIVAR NOTIFICAÇÕES NESTE CELULAR"}</button>{state==="error"&&<p className="muted">Não foi possível ativar neste aparelho. Verifique se as notificações estão permitidas neste navegador e tente novamente.</p>}</div>
}
