import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { caixaResultUrl, supportedLotteries, type SupportedLottery } from "./config";

type CaixaResult = {
  numero: number;
  dataApuracao?: string;
  listaDezenas?: string[];
  listaDezenasSegundoSorteio?: string[] | null;
  nomeTimeCoracaoMesSorte?: string | null;
  trevosSorteados?: string[] | null;
  listaTrevos?: string[] | null;
};

function publishedAt(value?: string) {
  if (!value) return null;
  const [day, month, year] = value.split("/").map(Number);
  return day && month && year ? new Date(Date.UTC(year, month - 1, day, 15)).toISOString() : null;
}

function numbers(values?: string[] | null) {
  return (values ?? []).map(Number).filter(Number.isFinite);
}

function specialValue(lottery: SupportedLottery, result: CaixaResult) {
  if (lottery === "dia-de-sorte") return { month: result.nomeTimeCoracaoMesSorte ?? null };
  if (lottery === "timemania") return { team: result.nomeTimeCoracaoMesSorte ?? null };
  if (lottery === "mais-milionaria") return { trevos: numbers(result.trevosSorteados ?? result.listaTrevos) };
  return null;
}

async function fetchCaixa(lottery: SupportedLottery, contest?: number): Promise<CaixaResult> {
  const response = await fetch(caixaResultUrl(lottery, contest), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`CAIXA ${lottery}: HTTP ${response.status}`);
  return response.json() as Promise<CaixaResult>;
}

async function upsertResult(lottery: SupportedLottery, result: CaixaResult) {
  const admin = createAdminClient();
  const rows = [{
    lottery,
    contest_number: result.numero,
    draw_index: 1,
    numbers: numbers(result.listaDezenas),
    special_value: specialValue(lottery, result),
    source: "CAIXA",
    published_at: publishedAt(result.dataApuracao),
  }];

  if (lottery === "dupla-sena" && result.listaDezenasSegundoSorteio?.length) {
    rows.push({ ...rows[0], draw_index: 2, numbers: numbers(result.listaDezenasSegundoSorteio) });
  }

  const { error } = await admin.from("lottery_results").upsert(rows, {
    onConflict: "lottery,contest_number,draw_index",
  });
  if (error) throw error;
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work));
  }
}

export async function syncLottery(lottery: SupportedLottery) {
  const admin = createAdminClient();
  const latest = await fetchCaixa(lottery);
  const firstContest = Math.max(1, latest.numero - 49);

  const { data } = await admin
    .from("lottery_results")
    .select("contest_number")
    .eq("lottery", lottery)
    .gte("contest_number", firstContest);

  const stored = new Set((data ?? []).map((row) => Number(row.contest_number)));
  const missing: number[] = [];
  for (let contest = firstContest; contest <= latest.numero; contest += 1) {
    if (!stored.has(contest)) missing.push(contest);
  }

  // Refresh the latest result and backfill missing contests in small parallel batches.
  // This keeps pressure on the CAIXA service low while making the initial 50-contest load practical.
  await inBatches(missing, 5, async (contest) => {
    await upsertResult(lottery, contest === latest.numero ? latest : await fetchCaixa(lottery, contest));
  });

  if (!missing.includes(latest.numero)) await upsertResult(lottery, latest);

  return { lottery, latest: latest.numero, fetched: missing.length };
}

export async function syncAllLotteryResults() {
  const results = [];
  for (const lottery of supportedLotteries) {
    try {
      results.push({ ok: true, ...(await syncLottery(lottery)) });
    } catch (error) {
      results.push({ ok: false, lottery, error: error instanceof Error ? error.message : "sync failed" });
    }
  }
  return results;
}
