import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
const digits=(v:string)=>v.replace(/\D/g,"");

async function recover(formData:FormData){
 "use server";
 const last4=digits(String(formData.get("last4")??""));
 if(last4.length!==4) redirect("/recuperar-acesso?erro=1");
 const admin=createAdminClient();
 const {data}=await admin.from("participants").select("access_token,phone,status,created_at").neq("status","cancelled").order("created_at",{ascending:false}).limit(500);
 const matches=(data??[]).filter(p=>digits(String(p.phone??"")).endsWith(last4)&&p.access_token);
 if(matches.length===0) redirect("/recuperar-acesso?nao_encontrado=1");
 if(matches.length>1) redirect(`/recuperar-acesso?duplicado=1&final=${encodeURIComponent(last4)}`);
 redirect(`/p/${matches[0].access_token}`);
}

async function requestLink(formData:FormData){
 "use server";
 const phone=digits(String(formData.get("phone")??""));
 const message=String(formData.get("message")??"").trim();
 if(phone.length<10 || !message) redirect("/recuperar-acesso?duplicado=1&pedido_erro=1");
 const admin=createAdminClient();
 const {data}=await admin.from("participants").select("id,pool_id,phone,status,created_at")
   .neq("status","cancelled").order("created_at",{ascending:false}).limit(500);
 const matches=(data??[]).filter(p=>digits(String(p.phone??""))===phone);
 if(!matches.length) redirect("/recuperar-acesso?duplicado=1&pedido_erro=1");
 const candidate=matches[0];
 const {error}=await admin.from("participant_support_messages").insert({
   pool_id:candidate.pool_id, participant_id:candidate.id, category:"help",
   message:`PEDIDO DE LINK DE ACESSO — ${message}`, status:"unread",
 });
 if(error) redirect("/recuperar-acesso?duplicado=1&pedido_erro=1");
 redirect("/recuperar-acesso?pedido_enviado=1");
}

export default async function Page({searchParams}:{searchParams:Promise<{erro?:string;nao_encontrado?:string;duplicado?:string;final?:string;pedido_erro?:string;pedido_enviado?:string}>}){
 const q=await searchParams;
 return <main className="shell"><Link className="back" href="/">← Voltar</Link>
 <section className="section"><h1>🔐 Recuperar meu acesso</h1>
 {q.pedido_enviado?<><p className="status">Pedido enviado ao organizador. Assim que ele localizar seu cadastro, poderá enviar novamente o seu link de acesso.</p><Link className="button secondary" href="/">VOLTAR AO INÍCIO</Link></>:<>
 <p className="muted">Digite os 4 últimos números do celular cadastrado na sua participação.</p>
 {q.erro&&<p className="status">Digite exatamente os 4 últimos números do celular.</p>}
 {q.nao_encontrado&&<p className="status">Não encontramos uma participação ativa com esses números. Confira e tente novamente.</p>}
 <form className="form" action={recover}><div className="field"><label>4 últimos números do celular</label><input name="last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={q.final||""} placeholder="0000" autoComplete="off" required /></div><button className="button primary">RECUPERAR MEU ACESSO</button></form></>}
 </section>
 {q.duplicado&&<div className="support-modal-backdrop" style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,.72)",display:"grid",placeItems:"center",padding:20}}>
   <section className="section" style={{width:"min(600px,100%)",maxHeight:"90vh",overflow:"auto",border:"1px solid #d8b63f",borderRadius:28,background:"#082315"}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"start"}}><div><h1>Fale com o organizador</h1><p className="muted">Encontramos mais de um cadastro com os mesmos 4 últimos números. Por segurança, peça ao organizador o seu link de acesso.</p></div><Link href="/recuperar-acesso" aria-label="Fechar" style={{fontSize:28,textDecoration:"none"}}>×</Link></div>
     {q.pedido_erro&&<p className="status">Não conseguimos identificar seu cadastro. Confira o número completo do celular.</p>}
     <form className="form" action={requestLink}>
       <div className="field"><label>Celular cadastrado</label><input name="phone" inputMode="tel" placeholder="(13) 99999-9999" autoComplete="tel" required /></div>
       <div className="field"><label>Mensagem</label><textarea name="message" defaultValue="Olá, perdi meu acesso ao JuntaSorte. Por favor, me envie novamente o meu link de acesso." rows={5} required /></div>
       <button className="button primary" type="submit">ENVIAR PEDIDO DO LINK</button>
     </form>
   </section>
 </div>}
 </main>;
}