"use client";
import {useEffect,useState} from "react";
import {ensureCurrentPushSubscription} from "@/lib/push/browser-subscription";

function withTimeout<T>(promise:Promise<T>,ms=12000):Promise<T>{
  return Promise.race([
    promise,
    new Promise<T>((_,reject)=>window.setTimeout(()=>reject(new Error("timeout")),ms)),
  ]);
}

async function ensureServiceWorker(){
  if(!("serviceWorker" in navigator))throw new Error("unsupported");
  let reg=await navigator.serviceWorker.getRegistration();
  if(!reg)reg=await navigator.serviceWorker.register("/sw.js",{scope:"/"});
  await withTimeout(navigator.serviceWorker.ready,12000);
  return reg;
}

function errorText(error:unknown){
  const code=error instanceof Error?error.message:"";
  if(code==="permission-blocked")return "As notificações estão bloqueadas neste navegador. Toque no cadeado/ícone ao lado do endereço do site, abra Permissões ou Configurações do site, libere Notificações e depois volte aqui para ativar novamente.";
  if(code==="permission")return "A permissão de notificações não foi concedida. Toque no botão novamente e escolha Permitir quando o navegador perguntar.";
  if(code==="unsupported")return "Este navegador não oferece suporte às notificações push deste aplicativo. Abra o link no Chrome atualizado ou instale o app na tela inicial e tente novamente.";
  if(code==="key")return "A chave de notificações do aplicativo não está disponível neste ambiente. Atualize a página e tente novamente.";
  if(code==="already-linked")return "Este celular já está vinculado às notificações de outro participante.";
  if(code==="service-worker")return "Não foi possível preparar o serviço de notificações neste aparelho. Feche e abra o navegador, atualize a página e tente novamente.";
  if(code==="timeout")return "A ativação demorou mais do que o esperado. Verifique sua internet, atualize a página e tente novamente.";
  if(code==="server")return "O celular aceitou a notificação, mas o aplicativo não conseguiu salvar a inscrição. Tente novamente em alguns instantes.";
  return "Não foi possível ativar as notificações neste aparelho. Atualize a página e tente novamente.";
}

export function ReminderOptIn({token,paid=false}:{token:string;paid?:boolean}){
  const[visible,setVisible]=useState(false);
  const[state,setState]=useState<"checking"|"idle"|"busy"|"ok"|"error">("checking");
  const[errorMessage,setErrorMessage]=useState("");

  useEffect(()=>{
    let cancelled=false;
    let timer:number|undefined;
    const checkExisting=async()=>{
      try{
        if(!("PushManager" in window)||!("Notification" in window))throw new Error("unsupported");
        const reg=await ensureServiceWorker();
        if(Notification.permission==="granted"){
          const existing=await withTimeout(reg.pushManager.getSubscription(),8000);
          if(existing){
            // Quem chega pelo temporizador pode já ter autorizado um lembrete
            // anônimo antes de reservar. Ao abrir o painel pela primeira vez,
            // vincule essa mesma inscrição ao cadastro recém-criado para que o
            // cartão do participante já reconheça a notificação como ativa.
            const res=await withTimeout(fetch("/api/push/subscribe",{
              method:"POST",
              headers:{"content-type":"application/json"},
              body:JSON.stringify({token,subscription:existing.toJSON()}),
            }),8000);
            if(res.ok&&!cancelled){setState("ok");setVisible(true);return;}
          }
        }
      }catch{}
      if(!cancelled){setState("idle");timer=window.setTimeout(()=>setVisible(true),paid?800:5000);}
    };
    checkExisting();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[token,paid]);

  const enable=async()=>{
    setState("busy");
    setErrorMessage("");
    try{
      if(!("PushManager" in window)||!("Notification" in window))throw new Error("unsupported");
      if(Notification.permission==="denied")throw new Error("permission-blocked");
      const permission=Notification.permission==="granted"?"granted":await withTimeout(Notification.requestPermission(),12000);
      if(permission==="denied")throw new Error("permission-blocked");
      if(permission!=="granted")throw new Error("permission");
      let reg:ServiceWorkerRegistration;
      try{reg=await ensureServiceWorker();}catch{throw new Error("service-worker");}
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if(!publicKey)throw new Error("key");
      const sub=await withTimeout(ensureCurrentPushSubscription(reg,publicKey),15000);
      const res=await withTimeout(fetch("/api/push/subscribe",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({token,subscription:sub.toJSON()}),
      }),12000);
      const result=await res.json().catch(()=>({}));
      if(!res.ok){if(res.status===409)throw new Error("already-linked");throw new Error("server");}
      setState("ok");setVisible(true);
    }catch(error){setErrorMessage(errorText(error));setState("error");setVisible(true);}
  };

  if(!visible||state==="checking")return null;
  if(state==="ok")return <div className="section"><h2>🔔 Notificações do bolão</h2><p className="status" style={{color:"#22c55e",fontWeight:800,fontSize:"1.15rem"}}>✅ NOTIFICAÇÃO ATIVA</p><p className="muted">{paid?"Você receberá avisos dos jogos, resultados, prêmios, créditos e novidades deste bolão. Como sua cota está quitada, não receberá lembretes de pagamento.":"Você receberá avisos deste bolão e lembretes de pagamento enquanto houver valor pendente."}</p></div>;
  return <div className="section"><h2>🔔 Notificações do bolão</h2><p className="muted">{paid?"Sua cota já está quitada. Ative as notificações para receber avisos dos jogos, resultados, prêmios, créditos e outras novidades do bolão. Você não receberá lembretes de pagamento.":"Ative as notificações para receber avisos deste bolão e lembretes enquanto seu pagamento estiver pendente."}</p><button className="button secondary" style={{color:"#38bdf8",fontWeight:800}} type="button" disabled={state==="busy"} onClick={enable}>{state==="busy"?"Ativando...":"🔔 ATIVAR NOTIFICAÇÕES NESTE CELULAR"}</button>{state==="error"&&<p className="status" style={{color:"#facc15"}}>⚠️ {errorMessage}</p>}</div>;
}
