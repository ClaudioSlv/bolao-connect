import Link from "next/link";
import { PersonalGameGenerator } from "@/components/personal-game-generator";
import { LotterySelector } from "@/components/lottery-selector";
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

export default async function Page({searchParams}:{searchParams:Promise<{lottery?:string;voltar?:string}>}) {
  const query = await searchParams;
  const q = query.lottery;
  const backHref = query.voltar?.startsWith("/p/") ? query.voltar : "/";
  const lottery = (lotteries.includes(q as Lottery) ? q : "lotofacil") as Lottery;
  let results: Array<{numbers:number[];special_value?:unknown}> = [];

  try {
    let data = await readResults(lottery);
    const contestCount = new Set(data.map((row) => Number(row.contest_number))).size;
    if (contestCount < 50) {
      await syncLottery(lottery as SupportedLottery);
      data = await readResults(lottery);
    }
    results = data as typeof results;
  } catch {
    // Mantém o gerador manual disponível se o serviço externo estiver indisponível.
  }

  return <main className="shell"><Link className="back" href={backHref}>← Voltar</Link><section className="section"><p className="eyebrow">JOGO PESSOAL</p><h1>🍀 Fazer meu próprio jogo</h1><p className="muted">Escolha a modalidade, monte seus próprios números ou use o gerador estatístico.</p><LotterySelector value={lottery} options={lotteries.map(value=>({value,label:labels[value]}))}/></section><section className="section"><h2>{labels[lottery]}</h2><PersonalGameGenerator key={lottery} lottery={lottery} results={results}/></section></main>;
}
