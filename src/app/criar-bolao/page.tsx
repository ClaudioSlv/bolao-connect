import Link from "next/link";
import {redirect} from "next/navigation";
import {AppNav} from "@/components/app-nav";
import {PoolCreationForm} from "@/components/pool-creation-form";
import {createPool} from "@/app/actions/pools";
import type {LotteryId} from "@/lib/domain";
import {calculatePoolPricing,type GamePlanInput} from "@/lib/lottery-pricing";

function brazilIso(v:string){
  if(!v)return undefined;
  const m=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if(!m)throw new Error("Data inválida.");
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`;
}

async function createPoolFromForm(f:FormData){
  "use server";
  const title=String(f.get("title")??"").trim();
  const lottery=String(f.get("lottery")??"mega-sena") as LotteryId;
  const contestText=String(f.get("contestNumber")??"").trim();
  const contestNumber=contestText?Number(contestText):undefined;
  const totalShares=Number(f.get("totalShares"));
  const prizeText=String(f.get("estimatedPrize")??"").trim().replace(/\./g,"").replace(",",".");
  const estimatedPrize=prizeText?Number(prizeText):undefined;
  const paymentDeadline=String(f.get("paymentDeadline")??"");
  const drawAt=String(f.get("drawAt")??"");

  let gamePlan:GamePlanInput[];
  try{
    gamePlan=JSON.parse(String(f.get("gamePlan")??"[]"));
  }catch{
    throw new Error("Não foi possível ler o planejamento dos jogos.");
  }

  if(!title||!paymentDeadline)throw new Error("Preencha corretamente os dados do bolão.");
  const pricing=calculatePoolPricing(lottery,gamePlan,totalShares);

  const created=await createPool({
    title,
    lottery,
    contestNumber,
    totalShares,
    sharePriceCents:pricing.sharePriceCents,
    totalCostCents:pricing.totalCostCents,
    paymentDeadline:brazilIso(paymentDeadline)!,
    drawAt:brazilIso(drawAt),
    estimatedPrizeCents:estimatedPrize!=null&&Number.isFinite(estimatedPrize)?Math.round(estimatedPrize*100):undefined,
    plannedGames:pricing.totalGames,
    numbersPerGame:pricing.uniformNumbers,
    gamePlan:pricing.items,
  });

  redirect(`/temporizador/${created.public_slug}`);
}

export default function CriarBolao(){
  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <h1>Criar novo bolão</h1>
      <p className="muted">Você escolhe a modalidade, informa os jogos e o número de participantes. O Bolão Connect calcula sozinho o custo total e o valor de cada cota.</p>
      <PoolCreationForm action={createPoolFromForm}/>
    </section>
    <AppNav/>
  </main>;
}
