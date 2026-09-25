import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileEfiParticipant } from "../status/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pix?: Array<{txid?: string}> } | null;
  const txids = [...new Set((body?.pix || []).map((p) => String(p?.txid || "")).filter(Boolean))];
  if (!txids.length) return NextResponse.json({ ok: true });
  const s = createAdminClient();
  const { data: sessions } = await s.from("payment_checkout_sessions").select("participant_id,provider_order_id").eq("provider","efi").in("provider_order_id",txids).in("status",["pending","processing","review_required"]);
  const participantIds=[...new Set((sessions||[]).map((x:any)=>x.participant_id).filter(Boolean))];
  if(!participantIds.length)return NextResponse.json({ok:true});
  const {data:participants}=await s.from("participants").select("id,access_token").in("id",participantIds);
  let reconciled=0;
  for(const p of participants||[]){if(!p.access_token)continue;await reconcileEfiParticipant(String(p.access_token));reconciled++;}
  return NextResponse.json({ok:true,reconciled});
}
