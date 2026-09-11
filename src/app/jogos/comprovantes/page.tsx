import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {PoolSwitcher} from "@/components/pool-switcher";
import {ReceiptCapture} from "@/components/receipt-capture";
import {ReceiptViewer} from "@/components/receipt-viewer";
import {uploadGameReceipt} from "@/app/actions/game-receipts";
export const dynamic="force-dynamic";

export default async function Receipts({searchParams}:{searchParams:Promise<{pool?:string;published?:string}>}){
 const{pool:requested,published}=await searchParams,s=await createClient(),{data:auth}=await s.auth.getUser();if(!auth.user)return <main className="shell"><p>Faça login.</p></main>;
 const{data:pools}=await s.from("pools").select("id,title,lottery,contest_number").eq("owner_id",auth.user.id).order("created_at",{ascending:false});const active=(pools??[]).find(p=>p.id===requested)??pools?.[0]??null;
 const admin=createAdminClient();let documents:any[]=[];if(active){const{data}=await admin.from("game_receipt_documents").select("id,title,game_receipt_pages(id,storage_path,page_order)").eq("pool_id",active.id).order("created_at",{ascending:false});documents=data??[]}
 const ready=await Promise.all(documents.map(async doc=>({...doc,pages:await Promise.all((doc.game_receipt_pages??[]).sort((a:any,b:any)=>a.page_order-b.page_order).map(async(page:any)=>{const{data}=await admin.storage.from("game-receipts").createSignedUrl(page.storage_path,3600);return{id:page.id,order:page.page_order,url:data?.signedUrl??""}}))})));
 return <main className="shell receipt-page"><Link className="back" href={active?`/jogos?pool=${active.id}`:"/jogos"}>← Voltar aos jogos</Link><section className="section"><h1>Comprovantes dos jogos</h1><p className="muted">As fotos aparecem para o participante como um comprovante contínuo e rolável.</p><PoolSwitcher pools={pools??[]} activeId={active?.id} basePath="/jogos/comprovantes"/></section>{published&&<p className="status">✓ Comprovante publicado.</p>}{active&&<section className="section card"><h2>Novo comprovante</h2><form className="form" action={uploadGameReceipt}><input type="hidden" name="poolId" value={active.id}/><div className="field"><label>Título</label><input name="title" defaultValue={`Comprovante · ${active.title}`}/></div><ReceiptCapture/><button className="button primary">Publicar para os participantes</button></form></section>}<section className="section"><h2>Já publicados</h2>{!ready.length?<p className="muted">Nenhum comprovante publicado.</p>:ready.map(doc=><ReceiptViewer key={doc.id} title={doc.title} pages={doc.pages.filter((p:any)=>p.url)}/>)}</section></main>
}
