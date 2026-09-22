import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BASE_PRICE_CENTS } from "@/lib/lottery-pricing";

export async function GET() {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data, error } = await client
    .from("organizer_lottery_prices")
    .select("lottery,base_price_cents")
    .eq("owner_id", auth.user.id);

  if (error) return NextResponse.json({ prices: DEFAULT_BASE_PRICE_CENTS });
  const prices = {
    ...DEFAULT_BASE_PRICE_CENTS,
    ...Object.fromEntries((data ?? []).map((row) => [row.lottery, Number(row.base_price_cents)])),
  };
  return NextResponse.json({ prices });
}
