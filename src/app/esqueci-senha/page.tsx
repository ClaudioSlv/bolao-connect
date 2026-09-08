"use client";

import {FormEvent,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";

export default function ForgotPasswordPage(){
  const[email,setEmail]=useState("");
  const[loading,setLoading]=useState(false);
  const[message,setMessage]=useState("");
  const[ok,setOk]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault();
    setLoading(true);setMessage("");setOk(false);
    const s=createClient();
    const redirectTo=`${window.location.origin}/auth/callback?next=/nova-senha`;
    const {error}=await s.auth.resetPasswordForEmail(email,{redirectTo});
    setLoading(false);
    if(error){setMessage("Não foi possível enviar o link agora. Confira o e-mail e tente novamente.");return;}
    setOk(true);
    setMessage("Enviamos um link para o seu e-mail. Abra esse link para criar uma nova senha.");
  }

  return <main className="shell">
    <Link className="back" href="/login">← Voltar</Link>
    <section className="section">
      <p className="eyebrow">RECUPERAR ACESSO</p>
      <h1>Criar nova senha</h1>
      <p className="muted">Digite o e-mail da conta de organizador. Você receberá um link seguro para definir uma senha nova.</p>
      <form className="form" onSubmit={submit}>
        <div className="field"><label htmlFor="email">E-mail do organizador</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
        {message&&<p className={ok?"status":"muted"}>{message}</p>}
        <button className="button primary" type="submit" disabled={loading}>{loading?"Enviando...":"Enviar link para criar senha"}</button>
      </form>
    </section>
  </main>;
}
