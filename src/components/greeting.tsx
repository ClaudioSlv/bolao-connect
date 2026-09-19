"use client";

import {useEffect,useState} from "react";

type GreetingProps={name:string};

const periodGreeting=(hour:number)=>{
 if(hour<12)return "Bom dia!";
 if(hour<18)return "Boa tarde!";
 return "Boa noite!";
};

export function Greeting({name}:GreetingProps){
 const [greeting,setGreeting]=useState("");

 useEffect(()=>{
  const update=()=>setGreeting(periodGreeting(new Date().getHours()));
  update();
  const timer=window.setInterval(update,60_000);
  return()=>window.clearInterval(timer);
 },[]);

 if(!greeting)return null;
 const firstName=name.trim().split(/\s+/)[0]||"Cláudio";

 return <p aria-label={`${greeting} ${firstName}`} style={{margin:"14px 0 2px",fontSize:18,fontWeight:800,textAlign:"left"}}>
  <span style={{color:"#f7c948"}}>{greeting}</span>{" "}
  <span style={{color:"#2f9bff"}}>{firstName}</span>
 </p>;
}
