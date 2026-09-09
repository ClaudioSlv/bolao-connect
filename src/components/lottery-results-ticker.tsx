"use client";

import { useEffect, useState } from "react";

type Prize = { label: string; winners: number };
type Result = { lottery:string; label:string; contest:number; drawDate:string|null; numbers:string[]; secondDrawNumbers:string[]; trevos:string[]; special:string|null; accumulated:boolean; nextPrize:number; prizes:Prize[] };

const tones:Record<string,string>={"mega-sena":"ticker-mega",lotofacil:"ticker-lotofacil",quina:"ticker-quina","dupla-sena":"ticker-dupla",lotomania:"ticker-lotomania",timemania:"ticker-timemania","dia-de-sorte":"ticker-dia","super-sete":"ticker-super","mais-milionaria":"ticker-milionaria"};
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});

export function LotteryResultsTicker(){
 const[results,setResults]=useState<Result[]>([]);
 useEffect(()=>{let cancelled=false;async function load(){try{const response=await fetch("/api/lottery-ticker",{cache:"no-store"});if(!response.ok)return;const data=(await response.json())as{results?:Result[]};if(!cancelled&&Array.isArray(data.results))setResults(data.results)}catch{}}load();const timer=window.setInterval(load,5*60*1000);return()=>{cancelled=true;window.clearInterval(timer)}},[]);
 if(!results.length)return null;
 const items=[...results,...results];
 return <aside className="lottery-ticker" aria-label="Últimos resultados das Loterias CAIXA"><div className="lottery-ticker-label">Resultados CAIXA</div><div className="lottery-ticker-window"><div className="lottery-ticker-track">{items.map((r,index)=><div className={`lottery-ticker-item ${tones[r.lottery]??""}`} key={`${r.lottery}-${index}`}><strong>{r.label}</strong><span>Concurso {r.contest}</span>{r.numbers.length>0&&<span className="ticker-numbers">{r.numbers.join(" • ")}</span>}{r.secondDrawNumbers.length>0&&<span>2º sorteio: <b>{r.secondDrawNumbers.join(" • ")}</b></span>}{r.trevos.length>0&&<span>Trevos: <b>{r.trevos.join(" • ")}</b></span>}{r.special&&<span><b>{r.special}</b></span>}<span className={r.accumulated?"ticker-accumulated":""}>{r.accumulated?"ACUMULOU":"Resultado oficial"}</span>{r.nextPrize>0&&<span>Próximo prêmio: <b>{money.format(r.nextPrize)}</b></span>}<i>◆</i></div>)}</div></div></aside>;
}
