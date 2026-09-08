import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

const SLUG="mega-da-virada-2026";
const TITLE="Mega da Virada 2026";

export async function GET(req:Request){
  const url=new URL(req.url);
  if(url.searchParams.get("confirm")!=="mega-2026")return NextResponse.json({ok:false,error:"Confirmation required"},{status:400});

  const s=createAdminClient();

  const {data:usersData,error:usersError}=await s.auth.admin.listUsers({page:1,perPage:2});
  if(usersError)return NextResponse.json({ok:false,stage:"users",error:usersError.message},{status:503});
  const users=usersData?.users??[];
  if(users.length!==1)return NextResponse.json({ok:false,stage:"users",error:"O bootstrap exige exatamente uma conta de organizador.",userCount:users.length},{status:409});

  const owner=users[0];
  const displayName=String(owner.user_metadata?.full_name??owner.user_metadata?.name??owner.email?.split("@")[0]??"Organizador").slice(0,120);
  const {error:profileError}=await s.from("profiles").upsert({id:owner.id,display_name:displayName},{onConflict:"id"});
  if(profileError)return NextResponse.json({ok:false,stage:"profile",error:profileError.message},{status:503});

  const basePayload:any={
    owner_id:owner.id,
    title:TITLE,
    lottery:"mega-sena",
    contest_number:null,
    estimated_prize_cents:null,
    share_price_cents:13104,
    total_shares:50,
    payment_deadline:"2026-10-10T11:00:00.000Z",
    draw_at:null,
    status:"open",
    public_slug:SLUG,
    planned_games:13,
    numbers_per_game:9,
  };

  const {data:existing,error:existingError}=await s.from("pools").select("id,public_slug").eq("public_slug",SLUG).maybeSingle();
  if(existingError)return NextResponse.json({ok:false,stage:"lookup",error:existingError.message},{status:503});

  let result:any;
  if(existing){
    result=await s.from("pools").update(basePayload).eq("id",existing.id).select("id,public_slug,title,status").single();
  }else{
    result=await s.from("pools").insert(basePayload).select("id,public_slug,title,status").single();
  }

  if(result.error&&/planned_games|numbers_per_game/i.test(result.error.message)){
    const {planned_games:_plannedGames,numbers_per_game:_numbersPerGame,...legacyPayload}=basePayload;
    result=existing
      ?await s.from("pools").update(legacyPayload).eq("id",existing.id).select("id,public_slug,title,status").single()
      :await s.from("pools").insert(legacyPayload).select("id,public_slug,title,status").single();
  }

  if(result.error)return NextResponse.json({ok:false,stage:"pool",error:result.error.message},{status:503});
  return NextResponse.json({ok:true,pool:result.data,timer:`/temporizador/${SLUG}`});
}
