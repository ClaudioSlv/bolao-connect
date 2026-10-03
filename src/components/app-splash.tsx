"use client";

import {useEffect,useState} from "react";
import "./app-splash.css";

const SESSION_KEY="juntasorte:splash-shown";

export function AppSplash(){
  const[visible,setVisible]=useState(false);
  const[leaving,setLeaving]=useState(false);

  useEffect(()=>{
    // A abertura animada deve aparecer somente quando o app é iniciado,
    // não a cada navegação entre telas internas.
    try{
      if(sessionStorage.getItem(SESSION_KEY)==="1")return;
      sessionStorage.setItem(SESSION_KEY,"1");
    }catch{}
    setVisible(true);
    const leave=window.setTimeout(()=>setLeaving(true),4000);
    const hide=window.setTimeout(()=>setVisible(false),4500);
    return()=>{window.clearTimeout(leave);window.clearTimeout(hide)};
  },[]);

  if(!visible)return null;
  return <div className={`app-splash${leaving?" app-splash-leaving":""}`} aria-hidden="true">
    <div className="app-splash-glow"/>
    <div className="app-splash-particles"><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="app-splash-logo-wrap">
      <img className="app-splash-logo" src="/icon.svg" alt=""/>
      <span className="app-splash-shine"/>
    </div>
  </div>;
}
