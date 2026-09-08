import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {DEFAULT_APP_BRAND} from "@/lib/organizer-brand";

async function saveIdentity(f:FormData){
  "use server";
  const brandName=String(f.get("brandName")??"").trim();
  if(!brandName||brandName.length>120)throw new Error("Informe um nome válido para os seus bolões.");

  const s=await createClient();
  const {data:auth}=await s.auth.getUser();
  if(!auth.user)redirect("/login");

  const displayName=String(auth.user.user_metadata?.full_name??auth.user.user_metadata?.name??auth.user.email?.split("@")[0]??"Organizador").slice(0,120);
  const {error}=await s.from("profiles").upsert({
    id:auth.user.id,
    display_name:displayName,
    brand_name:brandName,
    account_type:"organizer",
    updated_at:new Date().toISOString(),
  },{onConflict:"id"});
  if(error)throw new Error("A estrutura multi-organizador precisa ser aplicada no Supabase antes de salvar a identidade.");

  redirect("/");
}

export default async function OrganizerProfilePage(){
  const s=await createClient();
  const {data:auth}=await s.auth.getUser();
  if(!auth.user)redirect("/login");

  let brandName=String(auth.user.user_metadata?.brand_name??DEFAULT_APP_BRAND);
  let organizerSlug="";
  let customDomain="";
  try{
    const {data}=await s.from("profiles").select("brand_name,organizer_slug,custom_domain").eq("id",auth.user.id).maybeSingle();
    brandName=String(data?.brand_name||brandName);
    organizerSlug=String(data?.organizer_slug||"");
    customDomain=String(data?.custom_domain||"");
  }catch{}

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <p className="eyebrow">IDENTIDADE DO ORGANIZADOR</p>
      <h1>Minha marca</h1>
      <p className="muted">Esse nome será usado nas páginas públicas dos seus bolões. Logo e domínio próprio já estão previstos na estrutura e serão configurados em outra etapa.</p>
      <form className="form" action={saveIdentity}>
        <div className="field"><label>Nome da marca / grupo</label><input name="brandName" required maxLength={120} defaultValue={brandName}/></div>
        <div className="field"><label>Identificador do organizador</label><input value={organizerSlug||"Será criado após aplicar a estrutura no Supabase"} readOnly/></div>
        <div className="field"><label>Domínio próprio</label><input value={customDomain||"Configuração em uma próxima etapa"} readOnly/></div>
        <button className="button primary">SALVAR IDENTIDADE</button>
      </form>
    </section>
  </main>;
}
