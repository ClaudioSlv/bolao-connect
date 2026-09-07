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
    if (error) return setMessage(error.message);
    router.push("/"); router.refresh();
  }

  async function signup() {
    if (!email || password.length < 6) return setMessage("Informe um e-mail e uma senha com pelo menos 6 caracteres.");
    setLoading(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) return setMessage(error.message);
    setMessage("Cadastro realizado. Confira seu e-mail para confirmar a conta e depois entre no app.");
  }

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <h1>Entrar no Bolão Connect</h1>
      <p className="muted">Entre para criar e administrar seus bolões com segurança.</p>
      <form className="form" onSubmit={login}>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></div>
        {message && <p className="muted">{message}</p>}
        <button className="button primary" disabled={loading} type="submit">{loading ? "Aguarde..." : "Entrar"}</button>
        <button className="button secondary" disabled={loading} type="button" onClick={signup}>Criar conta</button>
      </form>
    </section>
  </main>;
}
