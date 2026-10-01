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
 const series=lottery==="lotofacil"?"JUNTASORTE · SÉRIE 20 EM 20":"JUNTASORTE";
 return <div className={`dynamic-lotofacil-cover lottery-theme-${themes[lottery]||"default"}${compact?" is-compact":""}`} role="img" aria-label={`${name}, concurso ${contestNumber||"aguardando confirmação"}`}>
   <div className="dynamic-lotofacil-glow" aria-hidden="true"/>
   <div className="dynamic-lotofacil-balls" aria-hidden="true">{[1,5,10,15,20,25].map(n=><i key={n}>{String(n).padStart(2,"0")}</i>)}</div>
   <div className="dynamic-lotofacil-copy"><small>{series}</small><strong>{name}</strong><b>CONCURSO {contestNumber||"—"}</b>{!compact&&<span>Sorteio: {drawLabel}</span>}</div>
   <em>{statusText(status)}</em>
 </div>;
}

// Compatibilidade com as telas que já usam a capa da Lotofácil.
export function DynamicLotofacilCover(props:Omit<Props,"lottery">){return <DynamicLotteryCover {...props} lottery="lotofacil"/>}
