"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { officialGamesCostCents } from "@/lib/lottery-pricing";

type LotteryRule = { label:string; min:number; max:number; defaultPick:number; minPick:number; maxPick:number; allowRepeat?:boolean };
type OCRMessage = { status?:string; progress?:number };
type TesseractGlobal = { recognize:(image:File|Blob|string,languages?:string,options?:{logger?:(message:OCRMessage)=>void},config?:Record<string,string>)=>Promise<{data?:{text?:string}}> };
declare global { interface Window { Tesseract?:TesseractGlobal } }

const STORAGE_KEY="bolao-amigos-btp:jogos-salvos";
const TESSERACT_SRC="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const rules:Record<string,LotteryRule>={
  "mega-sena":{label:"Mega-Sena",min:1,max:60,defaultPick:6,minPick:6,maxPick:20},
  lotofacil:{label:"Lotofácil",min:1,max:25,defaultPick:15,minPick:15,maxPick:20},
  quina:{label:"Quina",min:1,max:80,defaultPick:5,minPick:5,maxPick:15},
  "dupla-sena":{label:"Dupla Sena",min:1,max:50,defaultPick:6,minPick:6,maxPick:15},
  lotomania:{label:"Lotomania",min:0,max:99,defaultPick:50,minPick:50,maxPick:50},
  timemania:{label:"Timemania",min:1,max:80,defaultPick:10,minPick:10,maxPick:10},
  "dia-de-sorte":{label:"Dia de Sorte",min:1,max:31,defaultPick:7,minPick:7,maxPick:15},
  "super-sete":{label:"Super Sete",min:0,max:9,defaultPick:7,minPick:7,maxPick:7,allowRepeat:true},
  "mais-milionaria":{label:"+Milionária",min:1,max:50,defaultPick:6,minPick:6,maxPick:12},
};

function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  return new Promise<TesseractGlobal>((resolve,reject)=>{
    const existing=document.querySelector(`script[src="${TESSERACT_SRC}"]`) as HTMLScriptElement|null;
    if(existing){
      existing.addEventListener("load",()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("OCR indisponível")),{once:true});
      existing.addEventListener("error",()=>reject(new Error("Falha ao carregar OCR")),{once:true});
      return;
    }
    const script=document.createElement("script");script.src=TESSERACT_SRC;script.async=true;
    script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("OCR indisponível"));
    script.onerror=()=>reject(new Error("Falha ao carregar OCR"));document.head.appendChild(script);
  });
}

function numbersFromLine(line:string,rule:LotteryRule){
  const matches=line.match(/\d{1,3}/g)??[];
  const numbers=matches.map(Number).filter(n=>Number.isInteger(n)&&n>=rule.min&&n<=rule.max);
  if(rule.allowRepeat)return numbers;
  const unique:number[]=[];for(const n of numbers)if(!unique.includes(n))unique.push(n);return unique;
}

function normalizeGame(numbers:number[],rule:LotteryRule){return rule.allowRepeat?numbers:[...numbers].sort((a,b)=>a-b)}

function extractGames(text:string,rule:LotteryRule,pick:number){
  const games:number[][]=[];const seen=new Set<string>();
  const push=(numbers:number[])=>{if(numbers.length!==pick)return;const normalized=normalizeGame(numbers,rule);const key=normalized.join("-");if(!seen.has(key)){seen.add(key);games.push(normalized)}};
  const rawLines=text.replace(/[|]/g," ").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const candidates=rawLines.map(line=>numbersFromLine(line,rule)).filter(numbers=>numbers.length>=3);

  for(const numbers of candidates){
    if(numbers.length===pick)push(numbers);
    else if(numbers.length>pick&&numbers.length%pick===0)for(let i=0;i<numbers.length;i+=pick)push(numbers.slice(i,i+pick));
  }

  let buffer:number[]=[];
  for(const numbers of candidates){
    if(numbers.length>=pick){buffer=[];continue;}
    const merged=rule.allowRepeat?[...buffer,...numbers]:Array.from(new Set([...buffer,...numbers]));
    if(merged.length===pick){push(merged);buffer=[];continue;}
    if(merged.length< pick){buffer=merged;continue;}
    buffer=[...numbers];
  }

  if(!games.length){
    const allCandidates=candidates.flat();
    const all=rule.allowRepeat?allCandidates:Array.from(new Set(allCandidates));
    for(let i=0;i+pick<=all.length;i+=pick)push(all.slice(i,i+pick));
  }
  return games;
}

function formatGame(numbers:number[]){return numbers.map(n=>String(n).padStart(2,"0")).join(" ")}

async function preprocessImage(file:File):Promise<Blob>{
  try{
    const bitmap=await createImageBitmap(file);
    const maxSide=1600;
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale));
    const height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx){bitmap.close();return file;}
    ctx.drawImage(bitmap,0,0,width,height);bitmap.close();
    const image=ctx.getImageData(0,0,width,height);const data=image.data;
    for(let i=0;i<data.length;i+=4){
      const gray=.299*data[i]+.587*data[i+1]+.114*data[i+2];
      const contrast=Math.max(0,Math.min(255,(gray-128)*1.65+128));
      const value=contrast>205?255:contrast<72?0:contrast;
      data[i]=value;data[i+1]=value;data[i+2]=value;
    }
    ctx.putImageData(image,0,0);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Falha ao preparar imagem")),"image/jpeg",.86));
  }catch{return file;}
}

export default function TicketReaderPage(){
  const cameraRef=useRef<HTMLInputElement>(null),galleryRef=useRef<HTMLInputElement>(null);
  const [lottery,setLottery]=useState("lotofacil"),[pick,setPick]=useState(rules.lotofacil.defaultPick),[contest,setContest]=useState("");
  const [previewUrl,setPreviewUrl]=useState(""),[ocrText,setOcrText]=useState(""),[games,setGames]=useState<string[]>([]);
  const [reading,setReading]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState(""),[error,setError]=useState("");
  const rule=rules[lottery];
  const validGames=useMemo(()=>games.map(value=>numbersFromLine(value,rule)).filter(numbers=>numbers.length===pick),[games,pick,rule]);

  const changeLottery=(value:string)=>{setLottery(value);setPick(rules[value].defaultPick);setGames([]);setOcrText("");setMessage("");setError("")};

  const readImage=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    if(!file.type.startsWith("image/")){setError("Escolha uma foto do bilhete.");return;}
    if(file.size>15*1024*1024){setError("A imagem é muito grande. Tente outra foto com até 15 MB.");return;}
    if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl(URL.createObjectURL(file));
    setReading(true);setProgress(0);setError("");setMessage("Otimizando a foto para leitura...");setGames([]);
    try{
      const prepared=await preprocessImage(file);setMessage("Preparando reconhecimento dos números...");
      const tesseract=await loadTesseract();
      const result=await tesseract.recognize(prepared,"eng",{logger:item=>{if(typeof item.progress==="number")setProgress(Math.round(item.progress*100));if(item.status)setMessage(item.status==="recognizing text"?"Reconhecendo linhas do bilhete...":"Preparando reconhecimento...")}},
        {tessedit_char_whitelist:"0123456789 -.,/\n",tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});
      const text=result.data?.text?.trim()??"";setOcrText(text);
      const extracted=extractGames(text,rule,pick);setGames(extracted.map(formatGame));
      if(extracted.length)setMessage(`${extracted.length} jogo(s) encontrado(s). Confira todos os números antes de salvar.`);
      else setMessage("A foto foi lida, mas ainda não consegui fechar um jogo completo. Você pode corrigir o texto reconhecido ou tentar outra foto mais reta.");
    }catch(e){console.error(e);setError("Não consegui concluir a leitura. Tente fotografar o bilhete inteiro, de frente e com boa luz.");setMessage("");}
    finally{setReading(false);}
  };

  const reprocess=()=>{const extracted=extractGames(ocrText,rule,pick);setGames(extracted.map(formatGame));setError("");setMessage(extracted.length?`${extracted.length} jogo(s) separado(s) do texto.`:"Não encontrei jogos completos nesse texto.")};
  const editGame=(index:number,value:string)=>setGames(current=>current.map((game,i)=>i===index?value:game));
  const removeGame=(index:number)=>setGames(current=>current.filter((_,i)=>i!==index));
  const addGame=()=>setGames(current=>[...current,""]);

  const saveGames=()=>{
    setError("");setMessage("");const targetContest=Number(contest);
    if(!Number.isInteger(targetContest)||targetContest<=0){setError("Informe o número do concurso antes de salvar.");return;}
    if(!games.length){setError("Nenhum jogo foi reconhecido para salvar.");return;}
    const parsed=games.map(value=>numbersFromLine(value,rule));
    const invalidIndex=parsed.findIndex(numbers=>numbers.length!==pick||(!rule.allowRepeat&&new Set(numbers).size!==numbers.length)||numbers.some(n=>n<rule.min||n>rule.max));
    if(invalidIndex>=0){setError(`Confira o Jogo ${invalidIndex+1}. Ele precisa ter exatamente ${pick} número(s) válidos.`);return;}
    const storedGames=parsed.map(numbers=>({numbers:normalizeGame(numbers,rule),trevos:[] as number[]}));
    let totalCostCents=0;try{totalCostCents=officialGamesCostCents(lottery,storedGames)}catch{totalCostCents=0}
    try{
      const current=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
      const entry={id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,lottery,label:rule.label,games:storedGames,targetContest,totalCostCents,createdAt:new Date().toISOString(),source:"camera-ocr-v2"};
      localStorage.setItem(STORAGE_KEY,JSON.stringify([entry,...(Array.isArray(current)?current:[])]));setMessage(`${storedGames.length} jogo(s) salvo(s) no concurso ${targetContest}.`);
    }catch{setError("Não foi possível salvar os jogos neste aparelho.");}
  };

  return <main className="shell">
    <Link className="back" href="/jogos-salvos">← Voltar</Link>
    <section className="section"><p className="eyebrow">JOGOS SALVOS</p><h1>Ler bilhete com a câmera</h1><p className="muted">Tire uma foto do bilhete ou escolha uma imagem da galeria. O app melhora a imagem, reconhece as dezenas e separa os jogos para você revisar antes de salvar.</p></section>
    <section className="section">
      <div className="field"><label>Modalidade</label><select value={lottery} onChange={e=>changeLottery(e.target.value)}>{Object.entries(rules).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}</select></div>
      <div className="field"><label>Números por jogo</label><input type="number" min={rule.minPick} max={rule.maxPick} value={pick} onChange={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=rule.minPick&&value<=rule.maxPick)setPick(value)}}/><small className="muted">Para {rule.label}: de {rule.minPick} a {rule.maxPick} número(s) por jogo.</small></div>
      <div className="field"><label>Concurso</label><input type="number" inputMode="numeric" min="1" value={contest} onChange={e=>setContest(e.target.value)} placeholder="Ex.: 3780"/></div>
      <div className="actions" style={{display:"grid",gap:10}}><button className="button primary" type="button" onClick={()=>cameraRef.current?.click()} disabled={reading}>ABRIR CÂMERA</button><button className="button secondary" type="button" onClick={()=>galleryRef.current?.click()} disabled={reading}>ESCOLHER FOTO DA GALERIA</button></div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={readImage} style={{display:"none"}}/><input ref={galleryRef} type="file" accept="image/*" onChange={readImage} style={{display:"none"}}/>
      {previewUrl&&<div className="card" style={{marginTop:16}}><strong>Foto selecionada</strong><img src={previewUrl} alt="Bilhete selecionado" style={{width:"100%",maxHeight:420,objectFit:"contain",borderRadius:12,marginTop:10}}/></div>}
      {reading&&<div className="status" style={{marginTop:14}}>{message||"Lendo a foto..."} {progress>0?`${progress}%`:""}</div>}{error&&<div className="status" style={{marginTop:14}}>{error}</div>}{!reading&&message&&<div className="status" style={{marginTop:14}}>{message}</div>}
    </section>
    {(ocrText||games.length>0)&&<section className="section"><h2>Revisar leitura</h2><p className="muted"><strong>Confira todos os números reconhecidos antes de salvar.</strong> Se algum vier errado, corrija aqui.</p>
      {games.map((game,index)=><div className="card" key={index} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><strong>Jogo {index+1}</strong><button type="button" className="button secondary" onClick={()=>removeGame(index)} style={{width:"auto",padding:"8px 12px"}}>Remover</button></div><input value={game} inputMode="numeric" onChange={e=>editGame(index,e.target.value)} placeholder={`Digite ${pick} números separados por espaço`} style={{marginTop:10}}/><small className="muted">{numbersFromLine(game,rule).length}/{pick} números reconhecidos</small></div>)}
      <button type="button" className="button secondary" onClick={addGame}>+ Adicionar jogo manualmente</button>
      {ocrText&&<details style={{marginTop:16}}><summary>Ver texto reconhecido da foto</summary><div className="field" style={{marginTop:12}}><textarea rows={8} value={ocrText} onChange={e=>setOcrText(e.target.value)}/></div><button type="button" className="button secondary" onClick={reprocess}>Separar jogos novamente</button></details>}
      <div className="actions" style={{marginTop:18}}><button type="button" className="button primary" onClick={saveGames} disabled={!validGames.length}>SALVAR {validGames.length||""} JOGO(S)</button><Link className="button secondary" href="/meus-jogos-salvos">Ver meus jogos salvos</Link></div>
    </section>}
    <section className="section"><p className="muted">A leitura por câmera foi otimizada para reduzir o uso de memória e separar melhor vários jogos no mesmo bilhete. Em +Milionária, Dia de Sorte e Timemania, os campos especiais ainda devem ser conferidos manualmente.</p></section>
  </main>;
}
