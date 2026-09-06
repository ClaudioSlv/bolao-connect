import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function GamesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: pool }, { data: games }] = await Promise.all([
    supabase.from("pools").select("title,lottery,contest_number").eq("id", id).single(),
    supabase.from("games").select("id,label,numbers,official_receipt_path,created_at").eq("pool_id", id).order("created_at"),
  ]);
  if (!pool) return <main className="screen"><div className="card">Bolão não encontrado.</div></main>;
  return <main className="screen"><section className="hero"><span className="eyebrow">Jogos</span><h1>{pool.title}</h1><p>{pool.lottery}{pool.contest_number ? ` · Concurso ${pool.contest_number}` : ""}</p></section>
    <section className="card stack"><h2>Jogos cadastrados</h2>{(games ?? []).length === 0 ? <p>Nenhum jogo cadastrado ainda. O cadastro e upload do comprovante serão ligados ao armazenamento privado do Supabase.</p> : games!.map((g) => <div className="listRow" key={g.id}><div><strong>{g.label || "Jogo"}</strong><small>{Array.isArray(g.numbers) ? g.numbers.join(" · ") : ""}</small></div><span className="pill">Aguardando resultado</span></div>)}</section>
    <section className="card"><h2>Conferência</h2><p>Quando o resultado oficial for registrado, o motor de conferência compara os jogos. Modalidades ainda sem regra completa permanecem marcadas para validação oficial/manual.</p></section>
  </main>;
}
