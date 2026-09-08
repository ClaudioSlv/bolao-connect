"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMessage("Não foi possível entrar. Confira seu e-mail e senha.");
    router.push("/"); router.refresh();
  }

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <p className="eyebrow">ACESSO RESTRITO</p>
      <h1>Área do organizador</h1>
      <p className="muted">A criação e administração dos bolões é restrita ao organizador. Participantes entram somente pelo link do bolão.</p>
      <form className="form" onSubmit={login}>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></div>
        {message && <p className="muted">{message}</p>}
        <button className="button primary" disabled={loading} type="submit">{loading ? "Aguarde..." : "Entrar"}</button>
      </form>
      <div style={{marginTop:16,textAlign:"center"}}><Link href="/esqueci-senha" className="button secondary">🔑 Esqueci minha senha / Criar nova senha</Link></div>
    </section>
  </main>;
}
