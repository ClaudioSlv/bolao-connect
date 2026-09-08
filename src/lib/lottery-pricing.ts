import type { LotteryId } from "@/lib/domain";

export type GamePlanInput = {
  quantity: number;
  numbers: number;
  trevos?: number;
};

export type GamePlanItem = GamePlanInput & {
  unitPriceCents: number;
  subtotalCents: number;
};

export const LOTTERY_LABELS: Record<LotteryId,string> = {
  "mega-sena":"Mega-Sena",
  "lotofacil":"Lotofácil",
  "quina":"Quina",
  "dupla-sena":"Dupla Sena",
  "lotomania":"Lotomania",
  "timemania":"Timemania",
  "dia-de-sorte":"Dia de Sorte",
  "super-sete":"Super Sete",
  "mais-milionaria":"+Milionária",
};

export const LOTTERY_NUMBER_LIMITS: Record<LotteryId,{min:number;max:number;defaultValue:number;fixed?:boolean}> = {
  "mega-sena":{min:6,max:20,defaultValue:6},
  "lotofacil":{min:15,max:20,defaultValue:15},
  "quina":{min:5,max:15,defaultValue:5},
  "dupla-sena":{min:6,max:15,defaultValue:6},
  "lotomania":{min:50,max:50,defaultValue:50,fixed:true},
  "timemania":{min:10,max:10,defaultValue:10,fixed:true},
  "dia-de-sorte":{min:7,max:15,defaultValue:7},
  "super-sete":{min:7,max:21,defaultValue:7},
  "mais-milionaria":{min:6,max:12,defaultValue:6},
};

function combination(n:number,k:number){
  if(!Number.isInteger(n)||!Number.isInteger(k)||k<0||n<k)return 0;
  k=Math.min(k,n-k);
  let result=1;
  for(let i=1;i<=k;i++)result=(result*(n-k+i))/i;
  return Math.round(result);
}

const SUPER_SETE_PRICES:Record<number,number>={
  7:300,8:600,9:1200,10:2400,11:4800,12:9600,13:19200,14:38400,
  15:57600,16:86400,17:129600,18:194400,19:291600,20:437400,21:656100,
};

export function priceForGame(lottery:LotteryId,numbers:number,trevos=2){
  const limits=LOTTERY_NUMBER_LIMITS[lottery];
  if(!Number.isInteger(numbers)||numbers<limits.min||numbers>limits.max)throw new Error(`Quantidade inválida para ${LOTTERY_LABELS[lottery]}.`);

  switch(lottery){
    case "mega-sena": return combination(numbers,6)*600;
    case "lotofacil": return combination(numbers,15)*350;
    case "quina": return combination(numbers,5)*300;
    case "dupla-sena": return combination(numbers,6)*300;
    case "lotomania": return 300;
    case "timemania": return 350;
    case "dia-de-sorte": return combination(numbers,7)*250;
    case "super-sete": {
      const value=SUPER_SETE_PRICES[numbers];
      if(!value)throw new Error("Quantidade inválida para Super Sete.");
      return value;
    }
    case "mais-milionaria": {
      if(!Number.isInteger(trevos)||trevos<2||trevos>6)throw new Error("Informe de 2 a 6 trevos na +Milionária.");
      return combination(numbers,6)*combination(trevos,2)*600;
    }
  }
}

export function calculatePoolPricing(lottery:LotteryId,rawPlan:GamePlanInput[],participants:number){
  if(!Number.isInteger(participants)||participants<1||participants>100000)throw new Error("Informe uma quantidade válida de participantes.");
  if(!Array.isArray(rawPlan)||rawPlan.length<1||rawPlan.length>30)throw new Error("Adicione pelo menos um tipo de jogo.");

  const items:GamePlanItem[]=rawPlan.map(row=>{
    const quantity=Number(row.quantity),numbers=Number(row.numbers),trevos=row.trevos==null?undefined:Number(row.trevos);
    if(!Number.isInteger(quantity)||quantity<1||quantity>100000)throw new Error("Informe uma quantidade válida de jogos.");
    const unitPriceCents=priceForGame(lottery,numbers,trevos);
    return {quantity,numbers,trevos,unitPriceCents,subtotalCents:quantity*unitPriceCents};
  });

  const totalCostCents=items.reduce((sum,row)=>sum+row.subtotalCents,0);
  const totalGames=items.reduce((sum,row)=>sum+row.quantity,0);
  const sharePriceCents=Math.ceil(totalCostCents/participants);
  const projectedCollectionCents=sharePriceCents*participants;
  const roundingDifferenceCents=projectedCollectionCents-totalCostCents;
  const uniqueNumbers=[...new Set(items.map(row=>row.numbers))];

  return {
    items,
    totalCostCents,
    totalGames,
    sharePriceCents,
    projectedCollectionCents,
    roundingDifferenceCents,
    uniformNumbers:uniqueNumbers.length===1?uniqueNumbers[0]:undefined,
  };
}
