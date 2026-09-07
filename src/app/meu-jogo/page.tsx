import Link from "next/link";
import { PersonalGameGenerator } from "@/components/personal-game-generator";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLottery } from "@/lib/lottery-results/sync";
import type { SupportedLottery } from "@/lib/lottery-results/config";

const lotteries = ["mega-sena","lotofacil","quina","dupla-sena","lotomania","timemania","dia-de-sorte","super-sete","mais-milionaria"] as const;
type Lottery = typeof lotteries[number];
const labels: Record<Lottery,string> = {"mega-sena":"Mega-Sena",lotofacil:"Lotofácil",quina:"Quina","dupla-sena":"Dupla Sena",lotomania:"Lotomania",timemania:"Timemania","dia-de-sorte":"Dia de Sorte","super-sete":"Super Sete","mais-milionaria":"+Milionária"};

export const dynamic = "force-dynamic";

async function readResults(lottery: Lottery) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("lottery_results")
    .select("numbers,special_value,contest_number,draw_index")
    .eq("lottery", lottery)
    .order("contest_number", { ascending: false })
    .order("draw_index", { ascending: true })
    .limit(lottery === "dupla-sena" ? 100 : 50);
  return data ?? [];
}

export default async function Page({searchParams}:{searchParams:Promise<{lottery?:string}>}) {
  const q = (await searchParams).lottery;
  const lottery = (lotteries.includes(q as Lottery) ? q : "lotofacil") as Lottery;
  let results: Array<{numbers:number[];special_value?:unknown}> = [];

  try {
    let data = await readResults(lottery);
    const contestCount = new Set(data.map((row) => Number(row.contest_number))).size;

    // First access to a modality seeds the rolling 50-contest history automatically.
    // If the daily cron already populated it, this is effectively a no-op refresh.
    if (contestCount < 50) {
      await syncLottery(lottery as SupportedLottery);
      data = await readResults(lottery);
    }

    results = data as typeof results;
  } catch {
    // Keep the manual generator available if the external result service is temporarily unavailable.
  }

  return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><p className="eyebrow">JOGO PESSOAL</p><h1>🍀 Fazer meu próprio jogo</h1><p className="muted">Escolha a modalidade, monte seus próprios números ou use o gerador estatístico.</p><form method="get" className="form"><div className="field"><label>Modalidade</label><select name="lottery" defaultValue={lottery}>{lotteries.map(l=><option key={l} value={l}>{labels[l]}</option>)}</select></div><button className="button secondary" type="submit">Carregar modalidade</button></form></section><section className="section"><h2>{labels[lottery]}</h2><PersonalGameGenerator lottery={lottery} results={results}/></section></main>;
}
