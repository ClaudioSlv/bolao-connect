import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { addParticipant } from "@/app/actions/participants";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function addParticipantFromForm(formData: FormData) {
  "use server";
  const poolId = String(formData.get("poolId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const shares = Number(formData.get("shares"));
  if (!poolId || !name || !Number.isInteger(shares) || shares < 1) throw new Error("Preencha corretamente os dados do participante.");
  await addParticipant({ poolId, name, phone, shares });
  redirect("/participantes");
}

export default async function Participantes() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return <main className="shell"><Link className="back" href="/">← Voltar</Link><section className="section"><h1>👥 Participantes</h1><p className="muted">Entre na sua conta para gerenciar participantes.</p></section><AppNav /></main>;
  }

  const { data: pool } = await supabase.from("pools").select("id,title,total_shares").eq("owner_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: participants } = pool ? await supabase.from("participants").select("id,name,phone,shares,payment_status").eq("pool_id", pool.id).order("created_at", { ascending: true }) : { data: [] };
  const usedShares = (participants ?? []).reduce((sum, p) => sum + (Number(p.shares) || 0), 0);

  return <main className="shell">
    <Link className="back" href="/">← Voltar</Link>
    <section className="section">
      <h1>👥 Participantes</h1>
      <p className="muted">{pool ? `${pool.title} · ${usedShares}/${pool.total_shares} cotas distribuídas` : "Crie um bolão antes de adicionar participantes."}</p>
      {pool && <form className="form" action={addParticipantFromForm}>
        <input type="hidden" name="poolId" value={pool.id} />
        <div className="field"><label htmlFor="name">Nome</label><input id="name" name="name" required placeholder="Nome do participante" /></div>
        <div className="field"><label htmlFor="phone">WhatsApp</label><input id="phone" name="phone" inputMode="tel" placeholder="(13) 99999-9999" /></div>
        <div className="field"><label htmlFor="shares">Cotas</label><input id="shares" name="shares" type="number" min="1" max={Math.max(1, pool.total_shares - usedShares)} required defaultValue="1" /></div>
        <button className="button primary" type="submit" disabled={usedShares >= pool.total_shares}>+ Adicionar participante</button>
      </form>}
    </section>
    <section className="section list">
      {(participants ?? []).length ? (participants ?? []).map((p) => <div className="list-item" key={p.id}><div><strong>{p.name}</strong><span className="muted"> · {p.shares} {Number(p.shares) === 1 ? "cota" : "cotas"}</span>{p.phone && <div className="muted">{p.phone}</div>}</div><span className="status">{p.payment_status === "paid" ? "PAGO" : "PENDENTE"}</span></div>) : <p className="muted">Nenhum participante cadastrado.</p>}
    </section>
    <AppNav />
  </main>;
}
