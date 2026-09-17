"use client";

import {useEffect,useState} from "react";
import "./app-splash.css";

export function AppSplash(){
  const[visible,setVisible]=useState(true);
  const[leaving,setLeaving]=useState(false);

  useEffect(()=>{
    const leave=window.setTimeout(()=>setLeaving(true),6500);
    const hide=window.setTimeout(()=>setVisible(false),7000);
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
