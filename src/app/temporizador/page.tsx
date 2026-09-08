import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export default async function TimerRedirect(){
  try{
    const s=createAdminClient();
    const {data:pool,error}=await s.from("pools").select("public_slug").eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);
  }catch(error){
    try{
      const s=await createClient();
      const {data:auth}=await s.auth.getUser();
      if(auth.user){
        const {data:pool}=await s.from("pools").select("public_slug").eq("owner_id",auth.user.id).eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);
      }
    }catch{}

    return <main className="shell"><section className="section"><h1>Temporizador indisponível</h1><p className="muted">A conexão segura com o banco ainda não está disponível neste deploy. O organizador deve conferir a chave de serviço do Supabase na Vercel.</p></section></main>;
  }

  return <main className="shell"><section className="section"><h1>Nenhum bolão aberto</h1><p className="muted">Crie ou abra um bolão para gerar o temporizador.</p></section></main>;
}
