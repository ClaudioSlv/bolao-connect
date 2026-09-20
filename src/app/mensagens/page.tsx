import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const categoryLabel: Record<string, string> = { bug: "Bug no app", suggestion: "Sugestão", help: "Ajuda ou dúvida" };

async function markAsRead(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  await supabase.from("participant_support_messages").update({ status: "read", read_at: new Date().toISOString() }).eq("id", id).eq("status", "unread");
  revalidatePath("/mensagens");
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase.from("participant_support_messages").select("id,category,message,attachment_path,status,created_at,participants(name,phone),pools(title)").order("created_at", { ascending: false }).limit(100);
  const admin = createAdminClient();
  const messages = await Promise.all((data ?? []).map(async (item) => {
    let attachmentUrl: string | null = null;
    if (item.attachment_path) {
      const { data: signed } = await admin.storage.from("support-attachments").createSignedUrl(item.attachment_path, 3600);
      attachmentUrl = signed?.signedUrl ?? null;
    }
    return { ...item, attachmentUrl };
  }));
  return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>💬 Mensagens dos participantes</h1><p className="muted">Bugs, sugestões e pedidos de ajuda enviados pelo app.</p></section><section className="section support-inbox">{!messages.length ? <div className="card"><strong>Nenhuma mensagem recebida.</strong></div> : messages.map((item) => {
    const participant = item.participants as unknown as { name?: string; phone?: string } | null;
    const pool = item.pools as unknown as { title?: string } | null;
    return <article className={`support-inbox-card ${item.status === "unread" ? "support-unread" : ""}`} key={item.id}><div className="support-inbox-head"><span>{categoryLabel[item.category] ?? item.category}</span>{item.status === "unread" ? <b>NOVA</b> : <small>Lida</small>}</div><h2>{participant?.name || "Participante"}</h2><div className="muted">{pool?.title || "Bolão"}{participant?.phone ? ` · ${participant.phone}` : ""}</div><p>{item.message}</p>{item.attachmentUrl ? <a className="support-attachment" href={item.attachmentUrl} target="_blank" rel="noreferrer"><img src={item.attachmentUrl} alt="Imagem anexada pelo participante"/><span>Abrir imagem completa</span></a> : null}<div className="support-inbox-footer"><time>{new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>{item.status === "unread" ? <form action={markAsRead}><input type="hidden" name="id" value={item.id}/><button className="button secondary" type="submit">MARCAR COMO LIDA</button></form> : null}</div></article>;
  })}</section><AppNav/></main>;
}
