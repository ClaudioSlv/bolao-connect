"use client";
import {useState} from "react";

export function ReceiptCapture(){
 const[slots,setSlots]=useState([0]);
 return <div className="receipt-capture">
  <div className="receipt-guide"><strong>Digitalizar comprovante comprido</strong><span>Fotografe de cima para baixo e repita uma pequena faixa da foto anterior.</span></div>
  {slots.map((slot,index)=><div className="receipt-photo-slot" key={slot}><label><span>Parte {index+1}</span><input name="pages" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required={index===0}/></label>{index>0&&<button type="button" onClick={()=>setSlots(current=>current.filter(value=>value!==slot))}>Remover</button>}</div>)}
  {slots.length<12&&<button className="button secondary" type="button" onClick={()=>setSlots(current=>[...current,Math.max(...current)+1])}>+ Adicionar continuação</button>}
  <p className="receipt-capture-note">A ordem das partes será mantida. Confira se todas as dezenas estão nítidas antes de publicar.</p>
 </div>
}
