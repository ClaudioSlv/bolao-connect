"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";

const allowed=new Set(["image/jpeg","image/png","image/webp"]),max=10*1024*1024;
export async function uploadGameReceipt(form:FormData){
 const poolId=String(form.get("poolId")??""),title=String(form.get("title")??"").trim().slice(0,100);
 const files=form.getAll("pages").filter((value):value is File=>value instanceof File&&value.size>0);
 if(!poolId||!files.length)throw new Error("Selecione o bolão e pelo menos uma foto.");
 if(files.length>12)throw new Error("Envie no máximo 12 partes por comprovante.");
 for(const file of files){if(!allowed.has(file.type))throw new Error("Use fotos JPG, PNG ou WebP.");if(file.size>max)throw new Error("Cada foto deve ter no máximo 10 MB.")}
 const client=await createClient(),{data:auth}=await client.auth.getUser();if(!auth.user)throw new Error("Faça login.");
 const{data:pool}=await client.from("pools").select("owner_id,contest_number").eq("id",poolId).single();
 if(!pool||pool.owner_id!==auth.user.id)throw new Error("Você não pode publicar neste bolão.");
 const admin=createAdminClient(),{data:document,error}=await admin.from("game_receipt_documents").insert({pool_id:poolId,title:title||"Comprovante dos jogos",contest_number:pool.contest_number,status:"published",published_by:auth.user.id,published_at:new Date().toISOString()}).select("id").single();
 if(error||!document)throw new Error(error?.message||"Falha ao criar comprovante.");
 const uploaded:string[]=[];
 try{const rows=[];for(let i=0;i<files.length;i++){const file=files[i],ext=file.type.split("/")[1].replace("jpeg","jpg"),path=`${poolId}/${document.id}/${String(i+1).padStart(2,"0")}-${crypto.randomUUID()}.${ext}`;const{error:u}=await admin.storage.from("game-receipts").upload(path,file,{contentType:file.type,upsert:false});if(u)throw u;uploaded.push(path);rows.push({document_id:document.id,storage_path:path,page_order:i,mime_type:file.type,original_name:file.name,file_size:file.size})}const{error:p}=await admin.from("game_receipt_pages").insert(rows);if(p)throw p}
 catch(e){if(uploaded.length)await admin.storage.from("game-receipts").remove(uploaded);await admin.from("game_receipt_documents").delete().eq("id",document.id);throw e}
 redirect(`/jogos/comprovantes?pool=${encodeURIComponent(poolId)}&published=1`);
}
