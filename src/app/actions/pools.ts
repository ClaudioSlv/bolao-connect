"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LotteryId } from "@/lib/domain";
import type { GamePlanItem } from "@/lib/lottery-pricing";
import { DEFAULT_APP_BRAND } from "@/lib/organizer-brand";
import { sendWaitlistPromotionPush } from "@/lib/push/participant-notifications";

const LOTTERIES: LotteryId[] = ["mega-sena","lotofacil","quina","dupla-sena","lotomania","timemania","dia-de-sorte","super-sete","mais-milionaria"];

export type CreatePoolInput = {title:string;lottery:LotteryId;contestNumber?:number;totalShares:number;sharePriceCents:number;paymentOpensAt:string;paymentDeadline:string;drawAt?:string;estimatedPrizeCents?:number;plannedGames?:number;numbersPerGame?:number;totalCostCents?:number;gamePlan?:GamePlanItem[]};

export async function createPool(input:CreatePoolInput){
  const title=input.title.trim();if(!title||title.length>120)throw new Error("Informe um nome válido para o bolão.");if(!LOTTERIES.includes(input.lottery))throw new Error("Modalidade inválida.");if(input.contestNumber!=null&&(!Number.isInteger(input.contestNumber)||input.contestNumber<1))throw new Error("Informe um concurso válido.");if(!Number.isInteger(input.totalShares)||input.totalShares<1||input.totalShares>100000)throw new Error("Informe uma quantidade válida de cotas/vagas.");if(!Number.isInteger(input.sharePriceCents)||input.sharePriceCents<1)throw new Error("Informe um valor válido para a cota.");
  const opens=new Date(input.paymentOpensAt),deadline=new Date(input.paymentDeadline);if(Number.isNaN(opens.getTime()))throw new Error("Informe a abertura dos pagamentos.");if(Number.isNaN(deadline.getTime()))throw new Error("Informe o encerramento dos pagamentos.");if(deadline<=opens)throw new Error("O encerramento deve ser depois da abertura dos pagamentos.");
  const supabase=await createClient();const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Faça login para criar um bolão.");
  const displayName=String(auth.user.user_metadata?.full_name??auth.user.user_metadata?.name??auth.user.email?.split("@")[0]??"Organizador").slice(0,120);const brandName=String(auth.user.user_metadata?.brand_name??DEFAULT_APP_BRAND).trim().slice(0,120)||DEFAULT_APP_BRAND;const extendedProfile:any={id:auth.user.id,display_name:displayName,brand_name:brandName,account_type:"organizer",updated_at:new Date().toISOString()};let profileResult=await supabase.from("profiles").upsert(extendedProfile,{onConflict:"id"});if(profileResult.error&&/brand_name|account_type|updated_at/i.test(profileResult.error.message))profileResult=await supabase.from("profiles").upsert({id:auth.user.id,display_name:displayName},{onConflict:"id"});if(profileResult.error)throw new Error("Não foi possível preparar o perfil do organizador.");
  const slugBase=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"bolao";const publicSlug=`${slugBase}-${crypto.randomUUID().slice(0,8)}`;const payload:any={owner_id:auth.user.id,title,lottery:input.lottery,contest_number:input.contestNumber??null,total_shares:input.totalShares,share_price_cents:input.sharePriceCents,payment_opens_at:opens.toISOString(),payment_deadline:deadline.toISOString(),draw_at:input.drawAt||null,estimated_prize_cents:input.estimatedPrizeCents??null,planned_games:input.plannedGames??null,numbers_per_game:input.numbersPerGame??null,total_cost_cents:input.totalCostCents??null,game_plan:input.gamePlan??null,status:"open",public_slug:publicSlug};const{data,error}=await supabase.from("pools").insert(payload).select().single();if(error){console.error("[createPool] pools insert failed",{code:error.code,message:error.message,details:error.details,hint:error.hint});throw new Error("Não foi possível salvar o bolão. Confirme se a migração 0013 foi aplicada no Supabase.");}revalidatePath("/");revalidatePath("/criar-bolao");revalidatePath("/jogos");revalidatePath("/conferencia");return data;
}

export async function increasePoolCapacity(input:{poolId:string;totalShares:number}){
  const totalShares=Number(input.totalShares);if(!input.poolId||!Number.isInteger(totalShares)||totalShares<1||totalShares>100000)throw new Error("Informe uma quantidade válida de vagas.");
  const supabase=await createClient();const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Faça login para alterar o bolão.");
  const{data:pool,error:poolError}=await supabase.from("pools").select("id,owner_id,total_shares,title").eq("id",input.poolId).maybeSingle();if(poolError||!pool||pool.owner_id!==auth.user.id)throw new Error("Você não pode alterar este bolão.");
  const oldTotal=Number(pool.total_shares)||0;if(totalShares<=oldTotal)throw new Error(`Para esta função, informe um total maior que ${oldTotal} vagas.`);
  const{error:updateError}=await supabase.from("pools").update({total_shares:totalShares}).eq("id",input.poolId).eq("owner_id",auth.user.id);if(updateError)throw new Error(updateError.message);
  const promotedIds:string[]=[];
  // A função do banco recalcula a capacidade a cada chamada. Assim, qualquer aumento
  // (5, 10, 20 ou mais vagas) promove somente quem realmente couber, sempre pela ordem da fila.
  for(let i=0;i<totalShares-oldTotal;i++){
    const{data:promoted,error:promotionError}=await supabase.rpc("promote_next_waitlisted",{p_pool_id:input.poolId});if(promotionError){console.error("Falha ao promover lista de espera",promotionError);break}if(!promoted)break;promotedIds.push(String(promoted));
  }
  for(const participantId of promotedIds){try{await sendWaitlistPromotionPush(participantId)}catch(e){console.error("Falha ao enviar push de promoção",e)}}
  await supabase.from("audit_events").insert({pool_id:input.poolId,actor_id:auth.user.id,event_type:"pool_capacity_increased",entity_type:"pool",entity_id:input.poolId,details:{from:oldTotal,to:totalShares,promoted_participant_ids:promotedIds}});
  revalidatePath("/");revalidatePath("/participantes");revalidatePath("/carteira");revalidatePath(`/bolao`);return {oldTotal,newTotal:totalShares,promoted:promotedIds.length,promotedIds};
}

export async function deletePool(poolId:string){if(!poolId)throw new Error("Bolão inválido.");const supabase=await createClient();const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Faça login para excluir um bolão.");const{data:pool,error:poolError}=await supabase.from("pools").select("id,owner_id,title").eq("id",poolId).maybeSingle();if(poolError||!pool||pool.owner_id!==auth.user.id)throw new Error("Você não pode excluir este bolão.");const{error}=await supabase.from("pools").delete().eq("id",poolId).eq("owner_id",auth.user.id);if(error){console.error("[deletePool] delete failed",{code:error.code,message:error.message,details:error.details,hint:error.hint,poolId});throw new Error("Não foi possível excluir o bolão. Tente novamente.");}revalidatePath("/");revalidatePath("/participantes");revalidatePath("/carteira");revalidatePath("/jogos");revalidatePath("/conferencia");redirect("/");}
