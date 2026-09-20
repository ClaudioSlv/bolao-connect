import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {DEFAULT_APP_BRAND} from "@/lib/organizer-brand";
import {removeOrganizerImage,uploadOrganizerImage} from "@/lib/organizer-images";

async function saveIdentity(f:FormData){
  "use server";
  const brandName=String(f.get("brandName")??"").trim();
  const logo=f.get("logo");
  const removeLogo=f.get("removeLogo")==="on";
  if(!brandName||brandName.length>120)throw new Error("Informe um nome válido para os seus bolões.");

  const s=await createClient();
  const {data:auth}=await s.auth.getUser();
  if(!auth.user)redirect("/login");

  const displayName=String(auth.user.user_metadata?.full_name??auth.user.user_metadata?.name??auth.user.email?.split("@")[0]??"Organizador").slice(0,120);
  const {data:current}=await s.from("profiles").select("logo_url,logo_path").eq("id",auth.user.id).maybeSingle();
  let logoUrl=removeLogo?null:current?.logo_url??null;
  let logoPath=removeLogo?null:current?.logo_path??null;
  if(logo instanceof File&&logo.size>0){
    const uploaded=await uploadOrganizerImage({ownerId:auth.user.id,kind:"logo",file:logo});
    logoUrl=uploaded.url;logoPath=uploaded.path;
  }
  const {error}=await s.from("profiles").upsert({
    id:auth.user.id,
    display_name:displayName,
    brand_name:brandName,
    logo_url:logoUrl,
    logo_path:logoPath,
    account_type:"organizer",
    updated_at:new Date().toISOString(),
  },{onConflict:"id"});
  if(error)throw new Error("A estrutura multi-organizador precisa ser aplicada no Supabase antes de salvar a identidade.");
  if((removeLogo||logoPath!==current?.logo_path)&&current?.logo_path&&current.logo_path!==logoPath)await removeOrganizerImage(current.logo_path);

  redirect("/");
}

export default async function OrganizerProfilePage(){
  const s=await createClient();
  const {data:auth}=await s.auth.getUser();
  if(!auth.user)redirect("/login");

  let brandName=String(auth.user.user_metadata?.brand_name??DEFAULT_APP_BRAND);
  let organizerSlug="";
  let customDomain="";
  let logoUrl="";
  try{
    const {data}=await s.from("profiles").select("brand_name,organizer_slug,custom_domain,logo_url").eq("id",auth.user.id).maybeSingle();
    brandName=String(data?.brand_name||brandName);
    organizerSlug=String(data?.organizer_slug||"");
    customDomain=String(data?.custom_domain||"");
    logoUrl=String(data?.logo_url||"");
  }catch{}

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <p className="eyebrow">IDENTIDADE DO ORGANIZADOR</p>
      <h1>Minha marca</h1>
      <p className="muted">Esse nome e essa logo serão usados nas páginas públicas dos seus bolões.</p>
      <form className="form" action={saveIdentity}>
        <div className="field"><label>Nome da marca / grupo</label><input name="brandName" required maxLength={120} defaultValue={brandName}/></div>
        {logoUrl&&<img src={logoUrl} alt="Logo atual" width="120" height="120" style={{borderRadius:20,objectFit:"cover",border:"1px solid #f7c948"}}/>}
        <div className="field"><label>Logo do grupo</label><input name="logo" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG ou WebP, até 5 MB.</small></div>
        {logoUrl&&<label><input type="checkbox" name="removeLogo"/> Remover a logo atual</label>}
        <div className="field"><label>Identificador do organizador</label><input value={organizerSlug||"Será criado após aplicar a estrutura no Supabase"} readOnly/></div>
        <div className="field"><label>Domínio próprio</label><input value={customDomain||"Configuração em uma próxima etapa"} readOnly/></div>
        <button className="button primary">SALVAR IDENTIDADE</button>
      </form>
    </section>
  </main>;
}
