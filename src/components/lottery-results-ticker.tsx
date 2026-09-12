"use client";

import { useEffect, useState } from "react";

type Prize = { label: string; winners: number };
type Result = { lottery:string; label:string; contest:number; drawDate:string|null; numbers:string[]; secondDrawNumbers:string[]; trevos:string[]; special:string|null; accumulated:boolean; nextPrize:number; prizes:Prize[] };
type LiveStatus={live:boolean;watchUrl?:string;poolTitle?:string;liveUntil?:string};

const tones:Record<string,string>={"mega-sena":"ticker-mega",lotofacil:"ticker-lotofacil",quina:"ticker-quina","dupla-sena":"ticker-dupla",lotomania:"ticker-lotomania",timemania:"ticker-timemania","dia-de-sorte":"ticker-dia", "super-sete":"ticker-super","mais-milionaria":"ticker-milionaria"};
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const fallback:Result[]=[
 {lottery:"mega-sena",label:"Mega-Sena",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"lotofacil",label:"Lotofácil",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"quina",label:"Quina",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"dupla-sena",label:"Dupla Sena",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"lotomania",label:"Lotomania",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"timemania",label:"Timemania",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"dia-de-sorte",label:"Dia de Sorte",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"super-sete",label:"Super Sete",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]},
 {lottery:"mais-milionaria",label:"+Milionária",contest:0,drawDate:null,numbers:[],secondDrawNumbers:[],trevos:[],special:null,accumulated:false,nextPrize:0,prizes:[]}
];

export function LotteryResultsTicker(){
 const[results,setResults]=useState<Result[]>(fallback);
 const[status,setStatus]=useState<"loading"|"online"|"error">("loading");
 const[live,setLive]=useState<LiveStatus>({live:false});
 useEffect(()=>{let cancelled=false;let resultTick=0;const testMode=new URLSearchParams(window.location.search).get("testeSorteio")==="1";async function load(){try{const requests:Promise<Response>[]=[fetch("/api/lottery-live",{cache:"no-store"})];if(resultTick%10===0)requests.push(fetch("/api/lottery-ticker",{cache:"no-store"}));const responses=await Promise.all(requests);const liveData=(await responses[0].json())as LiveStatus;if(!cancelled)setLive(testMode?{live:true,watchUrl:"https://www.youtube.com/@caixa/live",poolTitle:"Teste do sorteio ao vivo"}:liveData?.live?liveData:{live:false});if(responses[1]){if(!responses[1].ok)throw new Error("ticker api");const data=(await responses[1].json())as{results?:Result[]};if(!cancelled&&Array.isArray(data.results)&&data.results.length){setResults(data.results);setStatus("online")}else if(!cancelled)setStatus("error")}resultTick++}catch{if(testMode&&!cancelled)setLive({live:true,watchUrl:"https://www.youtube.com/@caixa/live",poolTitle:"Teste do sorteio ao vivo"});if(!cancelled&&resultTick===0)setStatus("error");resultTick++}}load();const timer=window.setInterval(load,30*1000);return()=>{cancelled=true;window.clearInterval(timer)}},[]);
 const items=[...results,...results];
 const waitingText=status==="loading"?"Buscando resultado…":"Resultado temporariamente indisponível";
 return <aside className={`lottery-ticker${live.live?" lottery-ticker-live":""}`} aria-label={live.live?"Sorteio das Loterias CAIXA ao vivo":"Últimos resultados das Loterias CAIXA"}>
  {live.live&&live.watchUrl?
   <a className="lottery-ticker-label lottery-live-button" href={live.watchUrl} target="_blank" rel="noreferrer" aria-label="Assistir ao sorteio ao vivo no canal oficial da CAIXA">
    <img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Loterias%20Caixa%20logo%202017.svg" alt="Loterias CAIXA"/>
    <span><b><i/> SORTEIO AO VIVO</b><small>TOQUE PARA ASSISTIR</small></span>
   </a>:
   <div className="lottery-ticker-label"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Loterias%20Caixa%20logo%202017.svg" alt="Loterias CAIXA"/><span>Resultados CAIXA</span></div>}
  <div className="lottery-ticker-window" tabIndex={0} title="Toque e segure para pausar os resultados">
   <div className="lottery-ticker-track">
    {items.map((r,index)=><article className={`lottery-ticker-item ${tones[r.lottery]??""}`} key={`${r.lottery}-${index}`}>
     <div className="ticker-heading"><strong>{r.label}</strong>{r.contest>0?<span>Concurso {r.contest}{r.drawDate?` · ${r.drawDate}`:""}</span>:<span>{waitingText}</span>}</div>
     {r.contest>0&&<div className="ticker-balls" aria-label={`Dezenas: ${r.numbers.join(", ")}`}>{r.numbers.map((number,numberIndex)=><span className="ticker-ball" key={`${number}-${numberIndex}`}>{number}</span>)}</div>}
     {r.secondDrawNumbers.length>0&&<div className="ticker-extra">2º sorteio: {r.secondDrawNumbers.join(" · ")}</div>}
     {r.trevos.length>0&&<div className="ticker-extra">Trevos: {r.trevos.join(" · ")}</div>}
     {r.special&&<div className="ticker-extra">{r.special}</div>}
     {r.nextPrize>0&&<div className="ticker-prize"><span className={r.accumulated?"ticker-accumulated":""}>{r.accumulated?"ACUMULOU":"Próximo prêmio"}</span><b>{money.format(r.nextPrize)}</b></div>}
    </article>)}
   </div>
  </div>
 </aside>;
}
