"use server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {sendTestNotification} from "@/lib/send-payment-push";
export type PushTestState={status:"idle"|"sent"|"no_subscription"|"expired"|"failed"|"configuration_error"|"unauthorized";message:string};
export async function sendParticipantTestPush(_previous:PushTestState,formData:FormData):Promise<PushTestState>{
  const token=String(formData.get("token")||""),s=await createClient(),{data:auth}=await s.auth.getUser();
  if(!auth.user)return {status:"unauthorized",message:"Entre novamente como organizador."};
  const {data:participant,error:participantError}=await createAdminClient().from("participants")
    .select("id,pool_id").eq("access_token",token).maybeSingle();
  if(participantError)return {status:"failed",message:"Não foi possível consultar o participante. Tente novamente."};
  if(!participant)return {status:"unauthorized",message:"Participante não encontrado."};
  const {data:pool,error:poolError}=await s.from("pools").select("id")
    .eq("id",participant.pool_id).eq("owner_id",auth.user.id).maybeSingle();
  if(poolError)return {status:"failed",message:"Não foi possível conferir o bolão. Tente novamente."};
  if(!pool)return {status:"unauthorized",message:"Somente o organizador deste bolão pode testar a notificação."};
  const result=await sendTestNotification(participant.id);
  if(result.status==="sent")return {status:"sent",message:`Enviada com sucesso para ${result.sent} aparelho(s).`};
  if(result.status==="no_subscription")return {status:"no_subscription",message:"Assinatura não encontrada. Ative novamente no celular."};
  if(result.status==="expired")return {status:"expired",message:"Assinatura vencida. Ative novamente no celular."};
  if(result.status==="configuration_error")return {status:"configuration_error",message:"As chaves de notificação não estão configuradas."};
  const code=result.errors[0]?.statusCode;
  return {status:"failed",message:code?`O serviço recusou o envio (erro ${code}).`:`O navegador/aparelho recusou o envio.`};
}
