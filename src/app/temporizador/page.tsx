import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

export default async function TimerRedirect(){
  const s=createAdminClient();
  const {data:pool}=await s.from("pools").select("public_slug").eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);
  return <main className="shell"><section className="section"><h1>Nenhum bolão aberto</h1><p className="muted">Crie ou abra um bolão para gerar o temporizador.</p></section></main>;
}
