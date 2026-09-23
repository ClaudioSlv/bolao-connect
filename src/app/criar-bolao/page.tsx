import Link from "next/link";
import {redirect} from "next/navigation";
import {AppNav} from "@/components/app-nav";
import {PoolCreationForm} from "@/components/pool-creation-form";
import {createPool,setPoolCoverImage} from "@/app/actions/pools";
import type {LotteryId} from "@/lib/domain";
import {calculatePoolPricing,type GamePlanInput,type LotteryPriceMap} from "@/lib/lottery-pricing";
import {createClient} from "@/lib/supabase/server";
function brazilIso(v:string){if(!v)return undefined;const m=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)throw new Error("Data inválida.");return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`;}
export type CreatePoolFormState={ok:boolean;message:string;publicSlug?:string};
const initialCreatePoolState:CreatePoolFormState={ok:false,message:""};
async function createPoolFromForm(_previousState:CreatePoolFormState,f:FormData):Promise<CreatePoolFormState>{"use server";
 try{
 const title=String(f.get("title")??"").trim(),lottery=String(f.get("lottery")??"mega-sena") as LotteryId;
 const contestText=String(f.get("contestNumber")??"").trim(),contestNumber=contestText?Number(contestText):undefined,totalShares=Number(f.get("totalShares"));
 const prizeText=String(f.get("estimatedPrize")??"").trim().replace(/\./g,"").replace(",","."),estimatedPrize=prizeText?Number(prizeText):undefined;
 const paymentOpensAt=String(f.get("paymentOpensAt")??""),paymentDeadline=String(f.get("paymentDeadline")??""),drawAt=String(f.get("drawAt")??"");
 const coverImage=f.get("coverImage");
 let gamePlan:GamePlanInput[];try{gamePlan=JSON.parse(String(f.get("gamePlan")??"[]"));}catch{throw new Error("Não foi possível ler o planejamento dos jogos.");}
 if(!title||!paymentOpensAt||!paymentDeadline)throw new Error("Preencha corretamente as datas do bolão.");
 const client=await createClient();const {data:auth}=await client.auth.getUser();if(!auth.user)throw new Error("Entre como organizador.");
 const {data:priceRows}=await client.from("organizer_lottery_prices").select("lottery,base_price_cents").eq("owner_id",auth.user.id);const prices=Object.fromEntries((priceRows??[]).map(row=>[row.lottery,Number(row.base_price_cents)])) as LotteryPriceMap;
 const pricing=calculatePoolPricing(lottery,gamePlan,totalShares,prices);
 const created=await createPool({title,lottery,contestNumber,totalShares,sharePriceCents:pricing.sharePriceCents,totalCostCents:pricing.totalCostCents,paymentOpensAt:brazilIso(paymentOpensAt)!,paymentDeadline:brazilIso(paymentDeadline)!,drawAt:brazilIso(drawAt),estimatedPrizeCents:estimatedPrize!=null&&Number.isFinite(estimatedPrize)?Math.round(estimatedPrize*100):undefined,plannedGames:pricing.totalGames,numbersPerGame:pricing.uniformNumbers,gamePlan:pricing.items});
 if(coverImage instanceof File&&coverImage.size>0){
  try{await setPoolCoverImage(created.id,coverImage);}catch(error){console.error("[createPoolFromForm] cover upload failed",error);return{ok:true,message:"Bolão criado com sucesso. A imagem da capa não pôde ser salva; você poderá adicioná-la depois.",publicSlug:created.public_slug};}
 }
 return{ok:true,message:"Bolão criado com sucesso.",publicSlug:created.public_slug};
 }catch(error){
  console.error("[createPoolFromForm] failed",error);
  return{ok:false,message:error instanceof Error?error.message:"Não foi possível criar o bolão. Tente novamente."};
 }
}
export default async function CriarBolao(){const client=await createClient();const {data:auth}=await client.auth.getUser();if(!auth.user)redirect("/login");const {data:priceRows}=await client.from("organizer_lottery_prices").select("lottery,base_price_cents").eq("owner_id",auth.user.id);const prices=Object.fromEntries((priceRows??[]).map(row=>[row.lottery,Number(row.base_price_cents)])) as LotteryPriceMap;return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>Criar novo bolão</h1><p className="muted">Defina quando os pagamentos abrem e quando encerram. O Bolão Amigos BTP controla o temporizador e a liberação automaticamente.</p><PoolCreationForm action={createPoolFromForm} initialState={initialCreatePoolState} initialPrices={prices}/></section><AppNav/></main>}
