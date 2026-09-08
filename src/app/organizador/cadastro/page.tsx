"use client";

import Link from "next/link";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";

export default function OrganizerSignupPage(){
  const router=useRouter();
  const[name,setName]=useState("");
  const[brandName,setBrandName]=useState("");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[confirmPassword,setConfirmPassword]=useState("");
  const[loading,setLoading]=useState(false);
  const[message,setMessage]=useState("");
  const[success,setSuccess]=useState(false);

  async function submit(event:FormEvent){
    event.preventDefault();
    setMessage("");setSuccess(false);
    if(password.length<6)return setMessage("A senha precisa ter pelo menos 6 caracteres.");
    if(password!==confirmPassword)return setMessage("As senhas não são iguais.");
    if(!name.trim()||!brandName.trim())return setMessage("Informe seu nome e o nome que aparecerá nos seus bolões.");

    setLoading(true);
    const s=createClient();
    const redirectTo=`${window.location.origin}/auth/callback?next=/`;
    const {data,error}=await s.auth.signUp({
      email:email.trim(),
      password,
      options:{
        emailRedirectTo:redirectTo,
        data:{full_name:name.trim(),brand_name:brandName.trim(),account_type:"organizer"},
      },
    });

    if(error){
      setLoading(false);
      return setMessage(error.message.includes("already")?"Este e-mail já possui cadastro. Use a tela de login.":"Não foi possível criar a conta de organizador.");
    }

    if(data.session&&data.user){
      const extended={id:data.user.id,display_name:name.trim().slice(0,120),brand_name:brandName.trim().slice(0,120),account_type:"organizer",updated_at:new Date().toISOString()};
      const result=await s.from("profiles").upsert(extended,{onConflict:"id"});
      if(result.error&&/brand_name|account_type|updated_at/i.test(result.error.message)){
        await s.from("profiles").upsert({id:data.user.id,display_name:name.trim().slice(0,120)},{onConflict:"id"});
      }
      setLoading(false);
      router.push("/");router.refresh();
      return;
    }

    setLoading(false);
    setSuccess(true);
    setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre como organizador.");
  }

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <p className="eyebrow">NOVO ORGANIZADOR</p>
      <h1>Crie seu próprio bolão</h1>
      <p className="muted">Cada organizador terá seus próprios bolões, participantes, pagamentos, carteira e jogos. A cobrança da plataforma ficará para uma etapa futura.</p>
      <form className="form" onSubmit={submit}>
        <div className="field"><label htmlFor="name">Seu nome</label><input id="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required placeholder="Ex.: João Silva"/></div>
        <div className="field"><label htmlFor="brand">Nome que aparecerá nos seus bolões</label><input id="brand" value={brandName} onChange={e=>setBrandName(e.target.value)} maxLength={120} required placeholder="Ex.: Bolão Amigos do João"/></div>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required/></div>
        <div className="field"><label htmlFor="confirm">Confirmar senha</label><input id="confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={6} required/></div>
        {message&&<p className={success?"status":"muted"}>{message}</p>}
        <button className="button primary" type="submit" disabled={loading}>{loading?"Criando conta...":"CRIAR CONTA DE ORGANIZADOR"}</button>
      </form>
      <p className="muted" style={{textAlign:"center",marginTop:16}}>Já tem cadastro? <Link className="back" href="/login">Entrar como organizador</Link></p>
    </section>
  </main>;
}
