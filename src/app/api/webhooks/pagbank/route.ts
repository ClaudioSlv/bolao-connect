import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function POST(request:Request){
  const payload=await request.json().catch(()=>null) as Record<string,any>|null;
  const orderId=String(payload?.id||payload?.order?.id||"");
  if(!orderId)return NextResponse.json({received:true});
  const s=createAdminClient();
  await s.from("payment_checkout_sessions").update({updated_at:new Date().toISOString()}).eq("provider","pagbank").eq("provider_order_id",orderId);
  return NextResponse.json({received:true});
}
