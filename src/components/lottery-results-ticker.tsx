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

function saoPauloMinutes(now=new Date()){
 const parts=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(now);
 const hour=Number(parts.find(part=>part.type==="hour")?.value??0);
 const minute=Number(parts.find(part=>part.type==="minute")?.value??0);
 return hour*60+minute;
}

function isResultRushWindow(now=new Date()){
 const minutes=saoPauloMinutes(now);
 return minutes>=20*60+45&&minutes<=22*60+30;
}

export function LotteryResultsTicker(){
 const[results,setResults]=useState<Result[]>(fallback);
 const[status,setStatus]=useState<"loading"|"online"|"error">("loading");
 const[live,setLive]=useState<LiveStatus>({live:false});
 useEffect(()=>{
  let cancelled=false;
  let resultTick=0;
  let lastFreshAt=0;
  const testMode=new URLSearchParams(window.location.search).get("testeSorteio")==="1";

  async function load(forceFresh=false){
   const shouldRefreshResults=forceFresh||resultTick===0||isResultRushWindow()||resultTick%10===0;
   const fresh=forceFresh||resultTick===0?"1":"0";
   const resultUrl=`/api/lottery-ticker?fresh=${fresh}&_=${Date.now()}`;

   const tasks:[Promise<Response>,Promise<Response|null>]=[
    fetch("/api/lottery-live",{cache:"no-store"}),
    shouldRefreshResults?fetch(resultUrl,{cache:"no-store",headers:{"Cache-Control":"no-cache"}}):Promise.resolve(null),
   ];
   const[liveOutcome,resultOutcome]=await Promise.allSettled(tasks);

   if(liveOutcome.status==="fulfilled"&&liveOutcome.value.ok){
    try{
     const liveData=(await liveOutcome.value.json())as LiveStatus;
     if(!cancelled)setLive(testMode?{live:true,watchUrl:"https://www.youtube.com/@caixa/live",poolTitle:"Teste do sorteio ao vivo"}:liveData?.live?liveData:{live:false});
    }catch{
     if(testMode&&!cancelled)setLive({live:true,watchUrl:"https://www.youtube.com/@caixa/live",poolTitle:"Teste do sorteio ao vivo"});
    }
   }else if(testMode&&!cancelled){
    setLive({live:true,watchUrl:"https://www.youtube.com/@caixa/live",poolTitle:"Teste do sorteio ao vivo"});
   }

   if(resultOutcome.status==="fulfilled"&&resultOutcome.value){
    try{
     if(!resultOutcome.value.ok)throw new Error("ticker api");
     const data=(await resultOutcome.value.json())as{results?:Result[]};
     if(!cancelled&&Array.isArray(data.results)&&data.results.length){
      setResults(data.results);
      setStatus("online");
     }else if(!cancelled){
      setStatus("error");
     }
    }catch{
     if(!cancelled)setStatus("error");
    }
   }else if(resultOutcome.status==="rejected"&&shouldRefreshResults&&!cancelled){
    setStatus("error");
   }

   resultTick++;
  }

  function refreshWhenVisible(){
   if(document.visibilityState!=="visible")return;
   const now=Date.now();
   if(now-lastFreshAt<5000)return;
   lastFreshAt=now;
   void load(true);
  }

  lastFreshAt=Date.now();
  void load(true);
  const timer=window.setInterval(()=>{void load(false)},30*1000);
  document.addEventListener("visibilitychange",refreshWhenVisible);
  window.addEventListener("focus",refreshWhenVisible);

  return()=>{
   cancelled=true;
   window.clearInterval(timer);
   document.removeEventListener("visibilitychange",refreshWhenVisible);
   window.removeEventListener("focus",refreshWhenVisible);
  };
 },[]);
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
