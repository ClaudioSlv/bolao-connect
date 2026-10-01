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
 if(matches.length>1){
   const ids=matches.map(p=>p.access_token);
   const {data:rows}=await admin.from("participants").select("id,pool_id,access_token").in("access_token",ids);
   const candidate=(rows??[])[0];
   if(candidate){
     await admin.from("participant_support_messages").insert({
       pool_id:candidate.pool_id,
       participant_id:candidate.id,
       category:"help",
       message:"Solicitação automática: perdi meu acesso ao JuntaSorte e preciso que o organizador me envie novamente o meu link de acesso.",
       status:"unread",
     });
   }
   redirect("/recuperar-acesso?duplicado=1&pedido=1");
 }
 redirect(`/p/${matches[0].access_token}`);
}

export default async function Page({searchParams}:{searchParams:Promise<{erro?:string;nao_encontrado?:string;duplicado?:string;pedido?:string}>}){
 const q=await searchParams;
 return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>🔐 Recuperar meu acesso</h1><p className="muted">Digite os 4 últimos números do celular cadastrado na sua participação.</p>{q.erro&&<p className="status">Digite exatamente os 4 últimos números do celular.</p>}{q.nao_encontrado&&<p className="status">Não encontramos uma participação ativa com esses números. Confira e tente novamente.</p>}{q.duplicado&&<p className="status">Encontramos mais de um cadastro com os mesmos 4 últimos números. Por segurança, não liberamos o acesso automaticamente. {q.pedido ? "Seu pedido do link já foi enviado ao organizador e ficará no painel de mensagens dele." : "Peça ao organizador o seu link de acesso."}</p>}<form className="form" action={recover}><div className="field"><label>4 últimos números do celular</label><input name="last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0000" autoComplete="off" required /></div><button className="button primary">RECUPERAR MEU ACESSO</button></form></section></main>;
}
