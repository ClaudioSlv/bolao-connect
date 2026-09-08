import {redirect} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

export const dynamic="force-dynamic";

const MEGA_SLUG="mega-da-virada-2026";

async function ensureMegaVirada2026(){
  const s=createAdminClient();

  const {data:existing,error:existingError}=await s.from("pools").select("id,public_slug,status").eq("public_slug",MEGA_SLUG).maybeSingle();
  if(existingError)throw existingError;
  if(existing?.public_slug){
    return existing.status==="open"?existing.public_slug:null;
  }

  const {data:usersData,error:usersError}=await s.auth.admin.listUsers({page:1,perPage:2});
  if(usersError)throw usersError;
  const users=usersData?.users??[];
  if(users.length!==1)return null;

  const owner=users[0];
  const displayName=String(owner.user_metadata?.full_name??owner.user_metadata?.name??owner.email?.split("@")[0]??"Organizador").slice(0,120);
  const {error:profileError}=await s.from("profiles").upsert({id:owner.id,display_name:displayName},{onConflict:"id"});
  if(profileError)throw profileError;

  const payload:any={
    owner_id:owner.id,
    title:"Mega da Virada 2026",
    lottery:"mega-sena",
    contest_number:null,
    estimated_prize_cents:null,
    share_price_cents:13104,
    total_shares:50,
    payment_deadline:"2026-10-10T11:00:00.000Z",
    draw_at:null,
    status:"open",
    public_slug:MEGA_SLUG,
    planned_games:13,
    numbers_per_game:9,
  };

  let result=await s.from("pools").insert(payload).select("public_slug").single();
  if(result.error&&/planned_games|numbers_per_game/i.test(result.error.message)){
    const {planned_games:_plannedGames,numbers_per_game:_numbersPerGame,...legacyPayload}=payload;
    result=await s.from("pools").insert(legacyPayload).select("public_slug").single();
  }
  if(result.error)throw result.error;
  return result.data?.public_slug??MEGA_SLUG;
}

export default async function TimerRedirect(){
  try{
    const s=createAdminClient();
    const {data:pool,error}=await s.from("pools").select("public_slug").eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);

    const megaSlug=await ensureMegaVirada2026();
    if(megaSlug)redirect(`/temporizador/${megaSlug}`);
  }catch(error){
    try{
      const s=await createClient();
      const {data:auth}=await s.auth.getUser();
      if(auth.user){
        const {data:pool}=await s.from("pools").select("public_slug").eq("owner_id",auth.user.id).eq("status","open").not("public_slug","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(pool?.public_slug)redirect(`/temporizador/${pool.public_slug}`);
      }
    }catch{}

    return <main className="shell"><section className="section"><h1>Temporizador indisponível</h1><p className="muted">Não foi possível preparar o bolão neste momento. Confira a conexão do Supabase e tente novamente.</p></section></main>;
  }

  return <main className="shell"><section className="section"><h1>Nenhum bolão aberto</h1><p className="muted">A Mega da Virada 2026 ainda não pôde ser associada à conta do organizador.</p></section></main>;
}
