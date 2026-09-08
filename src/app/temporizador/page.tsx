import Link from "next/link";
import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

export default async function TimerRedirect(){
  try{
    const s=createAdminClient();
    const {data:pool,error}=await s.from("pools").select("public_slug").eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);
  }catch{
    return <main className="shell"><section className="section"><h1>Temporizador indisponível</h1><p className="muted">Não foi possível carregar os bolões neste momento.</p></section></main>;
  }

  return <main className="shell"><section className="section"><h1>Nenhum bolão aberto</h1><p className="muted">O link do participante só fica disponível depois que o organizador cria o bolão.</p><Link className="button secondary" href="/login">Área do organizador</Link></section></main>;
}
