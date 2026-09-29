import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {efiAuthorizedScopes,efiRequest} from "@/lib/efi";
import {processEfiRefunds} from "@/lib/efi-refunds";

export const runtime="nodejs";

export async function POST(request:Request){
  const {participantId}=await request.json().catch(()=>({participantId:null}));
  if(typeof participantId!=="string"||!/^[0-9a-f-]{36}$/i.test(participantId))
    return NextResponse.json({error:"Participante inválido."},{status:400});
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return NextResponse.json({error:"Entre na conta do organizador."},{status:401});
  const s=createAdminClient();
  const {data:p}=await s.from("participants").select("pool_id,payment_status").eq("id",participantId).maybeSingle();
  const {data:pool}=p?await s.from("pools").select("owner_id").eq("id",p.pool_id).maybeSingle():{data:null};
  if(!pool||pool.owner_id!==user.id)return NextResponse.json({error:"Acesso negado."},{status:403});
  if(p?.payment_status==="confirmed")return NextResponse.json({error:"Cota já quitada; estorno bloqueado."},{status:409});
  const {data:choice}=await s.from("partial_payment_resolution_choices")
    .select("choice,status").eq("participant_id",participantId).maybeSingle();
  const {data:items}=await s.from("efi_refund_items")
    .select("e2e_id,refund_id,status").eq("participant_id",participantId);
  if(choice?.choice!=="refund"||choice.status!=="failed"||!items?.length||items.some(item=>item.status!=="failed"))
    return NextResponse.json({error:"Esta devolução não está elegível para nova tentativa."},{status:409});
  try{
    const scopes=await efiAuthorizedScopes();
    if(!scopes?.includes("pix.write"))
      return NextResponse.json({error:"Ative a permissão pix.write na aplicação da Efí antes de tentar novamente."},{status:409});
    for(const item of items){
      const bank=await efiRequest(`/v2/pix/${encodeURIComponent(item.e2e_id)}/devolucao/${encodeURIComponent(item.refund_id)}`);
      if(bank.status!==404&&bank.data?.nome!=="devolucao_nao_encontrada")
        return NextResponse.json({error:`A Efí retornou HTTP ${bank.status}${bank.data?.status?` (${bank.data.status})`:""}. Confira a devolução antes de repetir.`},{status:409});
    }
    const {data:requeued,error}=await s.rpc("retry_failed_efi_refund",{p_participant_id:participantId});
    if(error)throw error;
    if(!requeued)return NextResponse.json({error:"O estado mudou; confira a cota antes de tentar novamente."},{status:409});
    const result=await processEfiRefunds(participantId);
    return NextResponse.json({status:result.status});
  }catch(error){
    console.error("Efí refund retry failed",error);
    return NextResponse.json({error:"Não foi possível conferir a Efí. Nenhuma nova tentativa foi autorizada."},{status:502});
  }
}
