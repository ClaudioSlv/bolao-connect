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

const coverImages: Partial<Record<LotteryId,string>> = {
  timemania:"/capas/file_000000004af4820ea0407b12965520f9.png",
  lotomania:"/capas/file_000000006220820e974652e08c31a3b6.png",
  "super-sete":"/capas/file_000000007198820eb38abb6a12196daa.png",
  "dupla-sena":"/capas/file_0000000077b0820e9f080940b88bc703.png",
  "dia-de-sorte":"/capas/file_00000000aecc820ea7eeb16b6cee29b0.png",
  lotofacil:"/capas/file_00000000afd8820e912c0a21ca27bf53.png",
  quina:"/capas/file_00000000cac8820ebf3c9bb593c6bb08.png",
  "mais-milionaria":"/capas/file_00000000ee10820e8b19544bab3f3d4b.png",
  "mega-sena":"/capas/file_00000000ffc8820eba1367e49f3bf35b.png"
};

export function DynamicLotteryCover({lottery: lotteryProp="lotofacil",contestNumber}:Props){
  const lottery: LotteryId = lotteryProp ?? "lotofacil";
  const name=labels[lottery]||String(lottery).toUpperCase();
  const src=coverImages[lottery];

  if(src){
    return <div role="img" aria-label={`${name}, concurso ${contestNumber||"aguardando confirmação"}`} style={{width:"100%",overflow:"hidden",borderRadius:18,lineHeight:0}}>
      <img src={src} alt="" style={{display:"block",width:"100%",height:"auto"}} />
    </div>;
  }

  return <div role="img" aria-label={name}>{name}</div>;
}

// Compatibilidade com as telas que já usam a capa da Lotofácil.
export function DynamicLotofacilCover(props:Omit<Props,"lottery">){return <DynamicLotteryCover {...props} lottery="lotofacil"/>}
