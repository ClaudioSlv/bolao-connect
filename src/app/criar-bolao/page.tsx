import Link from "next/link";
import {redirect} from "next/navigation";
import {AppNav} from "@/components/app-nav";
import {PoolCreationForm} from "@/components/pool-creation-form";
import {createPool} from "@/app/actions/pools";
import type {LotteryId} from "@/lib/domain";
import {calculatePoolPricing,type GamePlanInput} from "@/lib/lottery-pricing";
function brazilIso(v:string){if(!v)return undefined;const m=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)throw new Error("Data inválida.");return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`;}
async function createPoolFromForm(f:FormData){"use server";
 const title=String(f.get("title")??"").trim(),lottery=String(f.get("lottery")??"mega-sena") as LotteryId;
 const contestText=String(f.get("contestNumber")??"").trim(),contestNumber=contestText?Number(contestText):undefined,totalShares=Number(f.get("totalShares"));
 const prizeText=String(f.get("estimatedPrize")??"").trim().replace(/\./g,"").replace(",","."),estimatedPrize=prizeText?Number(prizeText):undefined;
 const paymentOpensAt=String(f.get("paymentOpensAt")??""),paymentDeadline=String(f.get("paymentDeadline")??""),drawAt=String(f.get("drawAt")??"");
 let gamePlan:GamePlanInput[];try{gamePlan=JSON.parse(String(f.get("gamePlan")??"[]"));}catch{throw new Error("Não foi possível ler o planejamento dos jogos.");}
 if(!title||!paymentOpensAt||!paymentDeadline)throw new Error("Preencha corretamente as datas do bolão.");
 const pricing=calculatePoolPricing(lottery,gamePlan,totalShares);
 const created=await createPool({title,lottery,contestNumber,totalShares,sharePriceCents:pricing.sharePriceCents,totalCostCents:pricing.totalCostCents,paymentOpensAt:brazilIso(paymentOpensAt)!,paymentDeadline:brazilIso(paymentDeadline)!,drawAt:brazilIso(drawAt),estimatedPrizeCents:estimatedPrize!=null&&Number.isFinite(estimatedPrize)?Math.round(estimatedPrize*100):undefined,plannedGames:pricing.totalGames,numbersPerGame:pricing.uniformNumbers,gamePlan:pricing.items});
 redirect(`/temporizador/${created.public_slug}`);
}
export default function CriarBolao(){return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>Criar novo bolão</h1><p className="muted">Defina quando os pagamentos abrem e quando encerram. O Bolão Amigos BTP controla o temporizador e a liberação automaticamente.</p><PoolCreationForm action={createPoolFromForm}/></section><AppNav/></main>}
