"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createBrowserSupabaseClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      setLoading(false);
      if (error) return setMessage(error.message);
      setMessage("Cadastro realizado. Confira seu e-mail se a confirmação estiver habilitada.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMessage("Não foi possível entrar. Confira e-mail e senha.");
    router.push("/");
    router.refresh();
  }

  return (
    <main className="screen narrow">
      <section className="hero">
        <span className="eyebrow">Bolão Connect</span>
        <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p>Organize seus bolões, participantes, pagamentos e jogos em um só lugar.</p>
      </section>

      <form className="card stack" onSubmit={submit}>
        {mode === "signup" && (
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        )}
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {message && <p className="notice">{message}</p>}
        <button className="primary" disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}</button>
        <button type="button" className="secondary" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"}
        </button>
      </form>
    </main>
  );
}
