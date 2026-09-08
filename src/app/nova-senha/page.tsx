"use client";

import {FormEvent,useEffect,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";

export default function NewPasswordPage(){
  const[password,setPassword]=useState("");
  const[confirm,setConfirm]=useState("");
  const[ready,setReady]=useState(false);
  const[loading,setLoading]=useState(false);
  const[message,setMessage]=useState("");
  const[done,setDone]=useState(false);

  useEffect(()=>{
    let alive=true;
    const check=async()=>{
      const s=createClient();
      const {data}=await s.auth.getSession();
      if(!alive)return;
      if(!data.session){setMessage("Este link é inválido ou expirou. Solicite um novo link de recuperação.");return;}
      setReady(true);
    };
    check();
    return()=>{alive=false};
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();
    if(password.length<6){setMessage("A nova senha precisa ter pelo menos 6 caracteres.");return;}
    if(password!==confirm){setMessage("As duas senhas precisam ser iguais.");return;}
    setLoading(true);setMessage("");
    const s=createClient();
    const {error}=await s.auth.updateUser({password});
    setLoading(false);
    if(error){setMessage("Não foi possível salvar a nova senha. Solicite outro link e tente novamente.");return;}
    await s.auth.signOut();
    setDone(true);
    setMessage("Senha criada com sucesso. Agora você pode entrar como organizador.");
  }

  return <main className="shell">
    <Link className="back" href="/login">← Voltar</Link>
    <section className="section">
      <p className="eyebrow">NOVA SENHA</p>
      <h1>Definir senha do organizador</h1>
      {done?<><p className="status">{message}</p><Link className="button primary" href="/login">Entrar como organizador</Link></>:ready?<form className="form" onSubmit={submit}>
        <div className="field"><label htmlFor="password">Nova senha</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></div>
        <div className="field"><label htmlFor="confirm">Confirmar nova senha</label><input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={6} required /></div>
        {message&&<p className="muted">{message}</p>}
        <button className="button primary" type="submit" disabled={loading}>{loading?"Salvando...":"Criar nova senha"}</button>
      </form>:<><p className="muted">{message||"Validando o link de recuperação..."}</p>{message?<Link className="button secondary" href="/esqueci-senha">Solicitar novo link</Link>:null}</>}
    </section>
  </main>;
}
