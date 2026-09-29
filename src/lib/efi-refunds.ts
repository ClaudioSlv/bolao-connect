import {createAdminClient} from "@/lib/supabase/admin";
import {efiRequest} from "@/lib/efi";

type RefundItem = {
  payment_id: string; participant_id: string; e2e_id: string; txid: string;
  refund_id: string; original_cents: number; refund_cents: number;
  status: string; attempted_at: string | null;
};
const cents = (value: unknown) => Math.round(Number(String(value ?? "0").replace(",", ".")) * 100);
const endpoint = (item: RefundItem) => `/v2/pix/${encodeURIComponent(item.e2e_id)}/devolucao/${encodeURIComponent(item.refund_id)}`;

export async function processEfiRefunds(participantId: string) {
  const s = createAdminClient();
  const {data: choice} = await s.from("partial_payment_resolution_choices")
    .select("choice,status,amount_cents").eq("participant_id",participantId).maybeSingle();
  if (!choice || choice.choice !== "refund" || !["processing","completed"].includes(choice.status))
    return {status: choice?.status ?? "pending_review"};
  if (choice.status === "completed") return {status: "completed"};
  const {data: participant} = await s.from("participants")
    .select("payment_status").eq("id",participantId).single();
  if (!participant || participant.payment_status === "confirmed") return {status: "blocked"};
  const {data: items, error} = await s.from("efi_refund_items")
    .select("payment_id,participant_id,e2e_id,txid,refund_id,original_cents,refund_cents,status,attempted_at")
    .eq("participant_id",participantId).order("created_at",{ascending:true});
  if (error || !items?.length || items.reduce((sum,item)=>sum+Number(item.refund_cents),0)!==Number(choice.amount_cents))
    return {status:"review_required"};

  for (const item of items as RefundItem[]) {
    if (item.status === "completed" || item.status === "failed") continue;
    const stale = item.attempted_at && Date.now()-new Date(item.attempted_at).getTime()>5*60_000;
    if (item.status === "processing" && !stale) continue;
    let claimQuery = s.from("efi_refund_items")
      .update({status:"processing",attempted_at:new Date().toISOString()})
      .eq("payment_id",item.payment_id).eq("status",item.status);
    claimQuery = item.attempted_at ? claimQuery.eq("attempted_at",item.attempted_at) : claimQuery.is("attempted_at",null);
    const claim = await claimQuery.select("payment_id").maybeSingle();
    if (!claim.data) continue;
    try {
      // A mesma ID é sempre reutilizada. Após timeout, consultar antes de repetir o PUT.
      let result = await efiRequest(endpoint(item));
      if (result.status===404 || result.data?.nome==="devolucao_nao_encontrada") {
        const original = await efiRequest(`/v2/pix/${encodeURIComponent(item.e2e_id)}`);
        const pix = original.data;
        const otherRefunds = Array.isArray(pix?.devolucoes)
          ? pix.devolucoes.filter((entry: {id?:string})=>entry.id!==item.refund_id) : [];
        if (original.status!==200 || pix?.txid!==item.txid || cents(pix?.valor)!==Number(item.original_cents) || otherRefunds.length) {
          await s.from("efi_refund_items").update({status:"failed",provider_status:"ORIGINAL_PIX_REVIEW"}).eq("payment_id",item.payment_id);
          continue;
        }
        result = await efiRequest(endpoint(item), {method:"PUT",body:{valor:(Number(item.refund_cents)/100).toFixed(2)}});
      }
      const bankStatus = String(result.data?.status ?? "");
      if ((result.status===200 || result.status===201) && cents(result.data?.valor)===Number(item.refund_cents)) {
        await s.from("efi_refund_items").update({
          status:bankStatus==="DEVOLVIDO"?"completed":bankStatus==="NAO_REALIZADO"?"failed":"processing",
          provider_status:bankStatus,completed_at:bankStatus==="DEVOLVIDO"?new Date().toISOString():null,
        }).eq("payment_id",item.payment_id);
      } else if (result.status===400 || result.status===403) {
        await s.from("efi_refund_items").update({status:"failed",provider_status:`HTTP_${result.status}`}).eq("payment_id",item.payment_id);
      }
      // Erros incertos permanecem em processing para consulta com a mesma ID.
    } catch (error) {
      console.error("Efí refund status uncertain",item.payment_id,error);
    }
  }
  const {data: current} = await s.from("efi_refund_items")
    .select("status").eq("participant_id",participantId);
  if (current?.length && current.every(item=>item.status==="completed")) {
    const {error: updated} = await s.from("partial_payment_resolution_choices")
      .update({status:"completed",updated_at:new Date().toISOString()})
      .eq("participant_id",participantId).eq("status","processing");
    if (updated) console.error("Efí refund choice completion failed",participantId,updated);
    return {status:updated?"processing":"completed"};
  }
  return {status:current?.some(item=>item.status==="failed")?"review_required":"processing"};
}

export async function processPendingEfiRefunds(limit=5) {
  const s=createAdminClient();
  const {data} = await s.from("efi_refund_items").select("participant_id")
    .in("status",["pending","processing"])
    .or(`attempted_at.is.null,attempted_at.lt.${new Date(Date.now()-5*60_000).toISOString()}`)
    .order("created_at",{ascending:true}).limit(limit);
  const participants=[...new Set((data??[]).map(item=>item.participant_id))];
  for (const id of participants) await processEfiRefunds(id);
  return participants.length;
}
