"use client";

import { useEffect, useState } from "react";
import { ensureCurrentPushSubscription } from "@/lib/push/browser-subscription";

async function serviceWorker() {
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

async function save(subscription: PushSubscription) {
  const response = await fetch("/api/push/organizer-subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) throw new Error("server");
}

export function OrganizerNotificationOptIn() {
  const [state, setState] = useState<"checking" | "idle" | "busy" | "active" | "error">("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("unsupported");
        if (Notification.permission !== "granted") { if (!cancelled) setState("idle"); return; }
        const existing = await (await serviceWorker()).pushManager.getSubscription();
        if (!existing) { if (!cancelled) setState("idle"); return; }
        await save(existing);
        if (!cancelled) setState("active");
      } catch { if (!cancelled) setState("idle"); }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setState("busy"); setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window)) throw new Error("Este navegador não oferece suporte às notificações.");
      if (Notification.permission === "denied") throw new Error("As notificações estão bloqueadas. Libere nas configurações do site e tente novamente.");
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Você precisa tocar em Permitir para ativar os avisos.");
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("A chave de notificações não está disponível.");
      const subscription = await ensureCurrentPushSubscription(await serviceWorker(), publicKey);
      await save(subscription);
      setState("active");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ativar.");
      setState("error");
    }
  }

  if (state === "checking") return null;
  if (state === "active") return <div className="organizer-notification-status">🔔 Notificações do organizador ativas</div>;
  return <section className="section organizer-notification-card"><strong>🔔 Receba mensagens no celular</strong><span>Ative uma vez para ser avisado quando um participante enviar uma mensagem.</span><button className="button secondary" type="button" onClick={enable} disabled={state === "busy"}>{state === "busy" ? "ATIVANDO..." : "ATIVAR NOTIFICAÇÕES"}</button>{state === "error" ? <small>{message}</small> : null}</section>;
}
