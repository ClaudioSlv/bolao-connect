import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

const BEFORE_MS=15*60*1000;
const AFTER_MS=90*60*1000;
const CAIXA_LIVE_URL="https://www.youtube.com/@caixa/live";

type PoolDraw={
  id:string;
  title:string;
  lottery:string;
  contest_number:number|null;
  draw_at:string|null;
};

export async function GET(){
  const now=Date.now();
  const s=createAdminClient();
  const {data:pools,error}=await s
    .from("pools")
    .select("id,title,lottery,contest_number,draw_at")
    .in("status",["open","payment_closed"])
    .not("draw_at","is",null)
    .order("draw_at",{ascending:true})
    .limit(30);

  if(error)return NextResponse.json({live:false});

  const candidates: Array<{
    pool:PoolDraw;
    scheduledAt:number;
    watchUrl:string;
    source:"official"|"manual";
  }>=[];

  for(const pool of (pools??[]) as PoolDraw[]){
    let scheduledAt=pool.draw_at?new Date(pool.draw_at).getTime():NaN;
    let watchUrl=CAIXA_LIVE_URL;
    let source:"official"|"manual"="manual";

    if(pool.contest_number){
      const {data:broadcast}=await s
        .from("lottery_broadcasts")
        .select("scheduled_at,watch_url")
        .eq("lottery",pool.lottery)
        .eq("contest_number",pool.contest_number)
        .maybeSingle();
      if(broadcast?.scheduled_at){
        scheduledAt=new Date(broadcast.scheduled_at).getTime();
        watchUrl=broadcast.watch_url||CAIXA_LIVE_URL;
        source="official";
      }
    }

    if(Number.isFinite(scheduledAt)){
      candidates.push({pool,scheduledAt,watchUrl,source});
    }
  }

  const active=candidates.find(({scheduledAt})=>
    now>=scheduledAt-BEFORE_MS&&now<=scheduledAt+AFTER_MS
  );
  const next=candidates.find(({scheduledAt})=>scheduledAt-BEFORE_MS>now);

  if(!active){
    return NextResponse.json({
      live:false,
      nextScheduledAt:next?new Date(next.scheduledAt).toISOString():null,
    });
  }

  return NextResponse.json({
    live:true,
    poolTitle:active.pool.title,
    lottery:active.pool.lottery,
    contestNumber:active.pool.contest_number,
    scheduledAt:new Date(active.scheduledAt).toISOString(),
    liveFrom:new Date(active.scheduledAt-BEFORE_MS).toISOString(),
    liveUntil:new Date(active.scheduledAt+AFTER_MS).toISOString(),
    watchUrl:active.watchUrl,
    source:active.source,
  });
}
