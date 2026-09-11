"use client";
import {useEffect,useState} from "react";
import {ensureCurrentPushSubscription} from "@/lib/push/browser-subscription";

function withTimeout<T>(promise:Promise<T>,ms=12000):Promise<T>{return Promise.race([promise,new Promise<T>((_,reject)=>window.setTimeout(()=>reject(new Error("timeout")),ms))])}

export function ReminderOptIn({token,paid=false}:{token:string;paid?:boolean}){
  const[visible,setVisible]=useState(false);
  const[state,setState]=useState<"checking"|"idle"|"busy"|"ok"|"error">("checking");

  useEffect(()=>{
    let cancelled=false;
    let timer:number|undefined;
    const checkExisting=async()=>{
      try{
        if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw new Error();
        const reg=await withTimeout(navigator.serviceWorker.ready,8000);
        const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if(publicKey&&Notification.permission==="granted"){
          const sub=await withTimeout(ensureCurrentPushSubscription(reg,publicKey),12000);
          const res=await withTimeout(fetch("/api/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,subscription:sub.toJSON()})}),8000);
          if(res.ok&&!cancelled){setState("ok");setVisible(true);return;}
        }
      }catch{}
      if(!cancelled){setState("idle");timer=window.setTimeout(()=>setVisible(true),paid?800:5000)}
    };
    checkExisting();return()=>{cancelled=true;if(timer)window.clearTimeout(timer)};
  },[token,paid]);

  const enable=async()=>{
    setState("busy");
    try{
      if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw new Error("unsupported");
      const permission=Notification.permission==="granted"?"granted":await withTimeout(Notification.requestPermission(),12000);
      if(permission!=="granted")throw new Error("permission");
      const reg=await withTimeout(navigator.serviceWorker.ready,10000);
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if(!publicKey)throw new Error("key");
      const sub=await withTimeout(ensureCurrentPushSubscription(reg,publicKey),12000);
      const res=await withTimeout(fetch("/api/push/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,subscription:sub.toJSON()})}),10000);
      if(!res.ok)throw new Error("server");
      setState("ok");
      setVisible(true);
    }catch{
      setState("error");
      setVisible(true);
    }
  };

  if(!visible||state==="checking")return null;
  if(state==="ok")return <div className="section"><h2>🔔 Notificações do bolão</h2><p className="status" style={{color:"#22c55e",fontWeight:800,fontSize:"1.15rem"}}>✅ NOTIFICAÇÃO ATIVA</p><p className="muted">{paid?"Você receberá avisos dos jogos, resultados, prêmios, créditos e novidades deste bolão. Como sua cota está quitada, não receberá lembretes de pagamento.":"Você receberá avisos deste bolão e lembretes de pagamento enquanto houver valor pendente."}</p></div>;
  return <div className="section"><h2>🔔 Notificações do bolão</h2><p className="muted">{paid?"Sua cota já está quitada. Ative as notificações para receber avisos dos jogos, resultados, prêmios, créditos e outras novidades do bolão. Você não receberá lembretes de pagamento.":"Ative as notificações para receber avisos deste bolão e lembretes enquanto seu pagamento estiver pendente."}</p><button className="button secondary" style={{color:"#38bdf8",fontWeight:800}} type="button" disabled={state==="busy"} onClick={enable}>{state==="busy"?"Ativando...":"🔔 ATIVAR NOTIFICAÇÕES NESTE CELULAR"}</button>{state==="error"&&<p className="status" style={{color:"#facc15"}}>⚠️ Não foi possível ativar. Verifique a permissão de notificações deste site no navegador e toque no botão novamente.</p>}</div>
}
