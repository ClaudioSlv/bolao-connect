import type { LotteryId } from "@/lib/domain";

type Props = {
  lottery?: LotteryId | null;
  contestNumber?: number | null;
  drawAt?: string | null;
  estimatedPrizeCents?: number | null;
  status?: string | null;
  compact?: boolean;
};

const labels: Partial<Record<LotteryId,string>> = {
  "mega-sena":"MEGA-SENA", lotofacil:"LOTOFÁCIL", quina:"QUINA",
  "dupla-sena":"DUPLA SENA", lotomania:"LOTOMANIA", timemania:"TIMEMANIA",
  "dia-de-sorte":"DIA DE SORTE", "mais-milionaria":"+MILIONÁRIA", "super-sete":"SUPER SETE"
};
const themes: Partial<Record<LotteryId,string>> = {
  "mega-sena":"mega", lotofacil:"lotofacil", quina:"quina", "dupla-sena":"dupla",
  lotomania:"lotomania", timemania:"timemania", "dia-de-sorte":"dia", "mais-milionaria":"milionaria", "super-sete":"super"
};
const statusText=(s?:string|null)=>({open:"ABERTO",draft:"EM BREVE",closed:"ENCERRADO"})[s||""]||"EM PREPARAÇÃO";

export function DynamicLotteryCover({lottery="lotofacil",contestNumber,drawAt,status,compact=false}:Props){
 const drawLabel=drawAt?new Date(drawAt).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}):"Data aguardando confirmação";
 const name=labels[lottery]||String(lottery).toUpperCase();
 const series=lottery==="lotofacil"?"JUNTASORTE · SÉRIE 20 EM 20":"JUNTASORTE · SÉRIE ESPECIAL";
 const balls: Partial<Record<LotteryId,number[]>> = {"mega-sena":[1,10,20,30,42,60],lotofacil:[1,5,10,15,20,25],quina:[7,23,41,56,79],"dupla-sena":[1,12,23,34,45,50],"mais-milionaria":[1,17,25,31,42,50],timemania:[1,8,12,23,39,63],lotomania:[1,7,12,25,39,50]};
 const coverBalls=balls[lottery]||[1,5,10,15,20,25];
 return <div className={`dynamic-lotofacil-cover lottery-theme-${themes[lottery]||"default"}${compact?" is-compact":""}`} role="img" aria-label={`${name}, concurso ${contestNumber||"aguardando confirmação"}`}>
   <div className="dynamic-lotofacil-glow" aria-hidden="true"/>
   <div className="dynamic-lotofacil-balls" aria-hidden="true">{coverBalls.map(n=><i key={n}>{String(n).padStart(2,"0")}</i>)}</div>
   <div className="dynamic-lotofacil-copy"><small>{series}</small><strong>{name}</strong><b>CONCURSO {contestNumber||"—"}</b>{!compact&&<span>Sorteio: {drawLabel}</span>}</div>
   <em>{statusText(status)}</em>
 </div>;
}

// Compatibilidade com as telas que já usam a capa da Lotofácil.
export function DynamicLotofacilCover(props:Omit<Props,"lottery">){return <DynamicLotteryCover {...props} lottery="lotofacil"/>}
