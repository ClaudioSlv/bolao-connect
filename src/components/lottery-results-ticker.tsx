"use client";

import { useEffect, useState } from "react";

type Prize = { label: string; winners: number };
type Result = { lottery:string; label:string; contest:number; drawDate:string|null; numbers:string[]; secondDrawNumbers:string[]; trevos:string[]; special:string|null; accumulated:boolean; nextPrize:number; prizes:Prize[] };

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
 useEffect(()=>{let cancelled=false;async function load(){try{const response=await fetch("/api/lottery-ticker",{cache:"no-store"});if(!response.ok)throw new Error("ticker api");const data=(await response.json())as{results?:Result[]};if(!cancelled&&Array.isArray(data.results)&&data.results.length){setResults(data.results);setStatus("online");return}if(!cancelled)setStatus("error")}catch{if(!cancelled)setStatus("error")}}load();const timer=window.setInterval(load,5*60*1000);return()=>{cancelled=true;window.clearInterval(timer)}},[]);
 const items=[...results,...results];
 const waitingText=status==="loading"?"Buscando resultado…":"Resultado temporariamente indisponível";
 return <aside className="lottery-ticker" aria-label="Últimos resultados das Loterias CAIXA">
  <div className="lottery-ticker-label"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Loterias%20Caixa%20logo%202017.svg" alt="Loterias CAIXA"/><span>Resultados CAIXA</span></div>
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
