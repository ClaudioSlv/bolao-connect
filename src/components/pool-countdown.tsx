"use client";

import {useEffect,useMemo,useState} from "react";

function parts(target:string){
  const diff=Math.max(0,new Date(target).getTime()-Date.now());
  const totalSeconds=Math.floor(diff/1000);
  return {
    done:diff<=0,
    days:Math.floor(totalSeconds/86400),
    hours:Math.floor((totalSeconds%86400)/3600),
    minutes:Math.floor((totalSeconds%3600)/60),
    seconds:totalSeconds%60,
  };
}

export function PoolCountdown({target}:{target:string}){
  const initial=useMemo(()=>parts(target),[target]);
  const[value,setValue]=useState(initial);

  useEffect(()=>{
    const tick=()=>setValue(parts(target));
    tick();
    const timer=window.setInterval(tick,1000);
    return()=>window.clearInterval(timer);
  },[target]);

  if(value.done)return <div className="card"><strong>⏰ Prazo encerrado</strong><span>O prazo deste bolão chegou ao fim.</span></div>;

  const boxes=[
    [String(value.days).padStart(2,"0"),"DIAS"],
    [String(value.hours).padStart(2,"0"),"HORAS"],
    [String(value.minutes).padStart(2,"0"),"MIN"],
    [String(value.seconds).padStart(2,"0"),"SEG"],
  ];

  return <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"8px"}}>
    {boxes.map(([n,label])=><div key={label} className="card" style={{textAlign:"center",padding:"16px 8px"}}><strong style={{fontSize:"clamp(28px,8vw,54px)",lineHeight:1}}>{n}</strong><span style={{display:"block",marginTop:8,fontSize:12}}>{label}</span></div>)}
  </div>;
}
