import { NextResponse } from "next/server";
import { caixaResultUrl, supportedLotteries, type SupportedLottery } from "@/lib/lottery-results/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const labels: Record<SupportedLottery, string> = {
  "mega-sena": "Mega-Sena", lotofacil: "Lotofácil", quina: "Quina", "dupla-sena": "Dupla Sena",
  lotomania: "Lotomania", timemania: "Timemania", "dia-de-sorte": "Dia de Sorte",
  "super-sete": "Super Sete", "mais-milionaria": "+Milionária",
};
type CaixaRateio={descricaoFaixa?:string;numeroDeGanhadores?:number};
type CaixaLatest={numero?:number;dataApuracao?:string;listaDezenas?:string[]|null;listaDezenasSegundoSorteio?:string[]|null;listaTrevos?:string[]|null;nomeTimeCoracaoMesSorte?:string|null;acumulado?:boolean;valorEstimadoProximoConcurso?:number;listaRateioPremio?:CaixaRateio[]|null};

function normalize(lottery:SupportedLottery,data:CaixaLatest){
 const special=(data.nomeTimeCoracaoMesSorte??"").replace(/\0/g,"").trim()||null;
 return {lottery,label:labels[lottery],contest:Number(data.numero??0),drawDate:data.dataApuracao??null,numbers:Array.isArray(data.listaDezenas)?data.listaDezenas:[],secondDrawNumbers:Array.isArray(data.listaDezenasSegundoSorteio)?data.listaDezenasSegundoSorteio:[],trevos:Array.isArray(data.listaTrevos)?data.listaTrevos:[],special,accumulated:Boolean(data.acumulado),nextPrize:Number(data.valorEstimadoProximoConcurso??0),prizes:(data.listaRateioPremio??[]).map(row=>({label:row.descricaoFaixa??"Faixa",winners:Number(row.numeroDeGanhadores??0)}))};
}

async function fetchCaixa(lottery:SupportedLottery){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const url=caixaResultUrl(lottery);
  const response=await fetch(url,{headers:{Accept:"application/json","Accept-Language":"pt-BR,pt;q=0.9","User-Agent":"Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/150 Safari/537.36",Referer:"https://loterias.caixa.gov.br/",Origin:"https://loterias.caixa.gov.br"},cache:"no-store",signal:controller.signal});
  if(!response.ok)throw new Error(`CAIXA HTTP ${response.status}`);
  const text=await response.text();
  if(!text.trim().startsWith("{"))throw new Error("CAIXA retornou resposta não JSON");
  return normalize(lottery,JSON.parse(text) as CaixaLatest);
 }finally{clearTimeout(timeout)}
}

async function getLatest(lottery:SupportedLottery){
 let lastError:unknown;
 for(let attempt=1;attempt<=2;attempt++){
  try{const result=await fetchCaixa(lottery);if(result.contest>0)return result;throw new Error("Concurso inválido retornado pela CAIXA")}catch(error){lastError=error;if(attempt<2)await new Promise(r=>setTimeout(r,250*attempt))}
 }
 throw lastError instanceof Error?lastError:new Error("Falha ao consultar CAIXA");
}

export async function GET(){
 const results=[] as ReturnType<typeof normalize>[];const errors:{lottery:SupportedLottery;message:string}[]=[];
 // Consulta em pequenos lotes para reduzir bloqueios/rate-limit do serviço da CAIXA no Vercel.
 for(let i=0;i<supportedLotteries.length;i+=3){
  const group=supportedLotteries.slice(i,i+3);const settled=await Promise.allSettled(group.map(getLatest));
  settled.forEach((item,index)=>{const lottery=group[index];if(item.status==="fulfilled")results.push(item.value);else errors.push({lottery,message:item.reason instanceof Error?item.reason.message:"Falha ao consultar CAIXA"})});
 }
 return NextResponse.json({results,errors,updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"public, max-age=30, s-maxage=300, stale-while-revalidate=900","Access-Control-Allow-Origin":"*"}});
}
