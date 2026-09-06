"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { addParticipant } from "@/lib/data/participants";

export default function ParticipantsPage() {
  const params = useParams<{ id: string }>();
  const poolId = params.id;
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from("participants").select("id,name,shares,payment_status,status").eq("pool_id", poolId).order("created_at");
    setItems(data ?? []);
  }
  useEffect(() => { void load(); }, [poolId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await addParticipant({ poolId, name: String(form.get("name")), phone: String(form.get("phone") || ""), shares: Number(form.get("shares")) });
    if (!result.ok) return setMessage(result.error);
    event.currentTarget.reset();
    setMessage("Participante adicionado.");
    await load();
  }

  return <main className="screen"><section className="hero"><span className="eyebrow">Participantes</span><h1>Cotas do bolão</h1><p>Cadastre quem participa e quantas cotas cada pessoa possui.</p></section>
    <form className="card formRow" onSubmit={submit}><input name="name" placeholder="Nome" required /><input name="phone" placeholder="WhatsApp (opcional)" /><input name="shares" type="number" min="1" defaultValue="1" required /><button className="primary">Adicionar</button></form>
    {message && <p className="notice">{message}</p>}
    <section className="card stack">{items.length === 0 ? <p>Nenhum participante cadastrado.</p> : items.map((p) => <div className="listRow" key={p.id}><div><strong>{p.name}</strong><small>{p.shares} cota(s)</small></div><span className={`pill ${p.payment_status === "confirmed" ? "ok" : ""}`}>{p.payment_status === "confirmed" ? "Pago" : "Pendente"}</span></div>)}</section>
  </main>;
}
