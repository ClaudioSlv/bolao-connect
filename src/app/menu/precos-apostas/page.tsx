import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BASE_PRICE_CENTS,
  LOTTERY_LABELS,
  type LotteryPriceMap,
} from "@/lib/lottery-pricing";
import type { LotteryId } from "@/lib/domain";

export const dynamic = "force-dynamic";

const LOTTERIES = Object.keys(LOTTERY_LABELS) as LotteryId[];

function parsePrice(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000)
    throw new Error("Informe valores válidos maiores que zero.");
  return Math.round(amount * 100);
}

async function savePrices(formData: FormData) {
  "use server";
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Entre como organizador para alterar os preços.");

  const rows = LOTTERIES.map((lottery) => ({
    owner_id: auth.user!.id,
    lottery,
    base_price_cents: parsePrice(formData.get(lottery)),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from("organizer_lottery_prices")
    .upsert(rows, { onConflict: "owner_id,lottery" });
  if (error) throw new Error("Não foi possível salvar os preços.");

  revalidatePath("/menu/precos-apostas");
  revalidatePath("/criar-bolao");
  redirect("/menu/precos-apostas?salvo=1");
}

export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { salvo } = await searchParams;
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data } = await client
    .from("organizer_lottery_prices")
    .select("lottery,base_price_cents")
    .eq("owner_id", auth.user.id);

  const custom = Object.fromEntries(
    (data ?? []).map((row) => [row.lottery, Number(row.base_price_cents)]),
  ) as LotteryPriceMap;

  return (
    <main className="shell">
      <Link className="back" href="/menu">← Voltar ao Menu</Link>
      <section className="section">
        <p className="eyebrow">CONFIGURAÇÃO</p>
        <h1>Preços das apostas</h1>
        <p className="muted">
          Atualize aqui o preço da aposta simples de cada modalidade quando a CAIXA alterar os valores.
          Jogos com mais dezenas serão recalculados automaticamente.
        </p>
      </section>

      {salvo === "1" ? (
        <section className="section">
          <p className="status">✓ Preços atualizados com sucesso.</p>
        </section>
      ) : null}

      <form className="form section" action={savePrices}>
        {LOTTERIES.map((lottery) => {
          const cents = custom[lottery] ?? DEFAULT_BASE_PRICE_CENTS[lottery];
          return (
            <div className="field card" key={lottery}>
              <label>{LOTTERY_LABELS[lottery]} — aposta simples (R$)</label>
              <input
                name={lottery}
                inputMode="decimal"
                defaultValue={(cents / 100).toFixed(2).replace(".", ",")}
                required
              />
            </div>
          );
        })}
        <button className="button primary" type="submit">SALVAR NOVOS PREÇOS</button>
      </form>

      <section className="section card">
        <strong>Importante</strong>
        <span>
          Os novos preços serão usados nos próximos cálculos e conferências. Valores já registrados
          em bolões anteriores permanecem guardados no histórico.
        </span>
      </section>
      <AppNav />
    </main>
  );
}
