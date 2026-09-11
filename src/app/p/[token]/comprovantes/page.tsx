import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {ReceiptViewer} from "@/components/receipt-viewer";
export const dynamic="force-dynamic";

export default async function ParticipantReceipts({params}:{params:Promise<{token:string}>}){
 const{token}=await params,s=createAdminClient(),{data:participant}=await s.from("participants").select("pool_id,status").eq("access_token",token).maybeSingle();if(!participant||participant.status==="cancelled")return <main className="shell"><h1>Link inválido</h1></main>;
 const{data:pool}=await s.from("pools").select("title,lottery,contest_number").eq("id",participant.pool_id).single();const{data:documents}=await s.from("game_receipt_documents").select("id,title,game_receipt_pages(id,storage_path,page_order)").eq("pool_id",participant.pool_id).eq("status","published").order("published_at",{ascending:false});
 const ready=await Promise.all((documents??[]).map(async(doc:any)=>({...doc,pages:await Promise.all((doc.game_receipt_pages??[]).sort((a:any,b:any)=>a.page_order-b.page_order).map(async(page:any)=>{const{data}=await s.storage.from("game-receipts").createSignedUrl(page.storage_path,900);return{id:page.id,order:page.page_order,url:data?.signedUrl??""}}))})));
 return <main className="shell receipt-page"><Link className="back" href={`/p/${token}`}>← Voltar</Link><section className="section"><p className="eyebrow">ACESSO DO PARTICIPANTE</p><h1>Comprovantes dos jogos</h1><p><strong>{pool?.title}</strong></p><p className="muted">{pool?.lottery}{pool?.contest_number?` · Concurso ${pool.contest_number}`:""}</p><p className="muted">Toque no comprovante e deslize o dedo para conferir todos os jogos.</p></section><section className="section">{!ready.length?<div className="card"><strong>Aguardando publicação</strong><span>O organizador ainda não publicou os comprovantes.</span></div>:ready.map((doc:any)=><ReceiptViewer key={doc.id} title={doc.title} pages={doc.pages.filter((p:any)=>p.url)}/>)}</section></main>
}
