import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {efiAuthorizedScopes,efiRequest} from "@/lib/efi";

export const runtime="nodejs";

export async function GET(request:Request){
  const participantId=new URL(request.url).searchParams.get("participantId");
  if(!participantId || !/^[0-9a-f-]{36}$/i.test(participantId))
    return NextResponse.json({error:"Participante inválido."},{status:400});
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return NextResponse.json({error:"Entre na conta do organizador."},{status:401});
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("pool_id").eq("id",participantId).maybeSingle();
  const {data:pool}=p?await s.from("pools").select("owner_id").eq("id",p.pool_id).maybeSingle():{data:null};
  if(!pool||pool.owner_id!==user.id)return NextResponse.json({error:"Acesso negado."},{status:403});
  const {data:refund}=await s.from("efi_refund_items")
    .select("e2e_id,refund_id,status,provider_status").eq("participant_id",participantId).maybeSingle();
  if(!refund)return NextResponse.json({error:"Não há devolução Pix preparada."},{status:404});
  try{
    const scopes=await efiAuthorizedScopes();
    const bank=await efiRequest(`/v2/pix/${encodeURIComponent(refund.e2e_id)}/devolucao/${encodeURIComponent(refund.refund_id)}`);
    return NextResponse.json({
      pixWrite:scopes===null?"desconhecido":scopes.includes("pix.write"),
      localStatus:refund.status,
      bankHttpStatus:bank.status,
      bankStatus:bank.data?.status??null,
      bankError:bank.data?.nome??bank.data?.title??null,
    });
  }catch(error){
    console.error("Efí refund diagnostic failed",error);
    return NextResponse.json({error:"Não foi possível consultar a autorização da Efí."},{status:502});
  }
}
