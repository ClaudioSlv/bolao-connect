import { NextRequest, NextResponse } from "next/server";
import { syncAllLotteryResults } from "@/lib/lottery-results/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllLotteryResults();
  const failed = results.filter((result) => !result.ok);
  return NextResponse.json({ ok: failed.length === 0, results }, { status: failed.length ? 207 : 200 });
}
