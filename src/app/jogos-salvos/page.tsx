import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { PoolSwitcher } from "@/components/pool-switcher";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Pool = { id: string; title: string; lottery: string };

export default async function SavedGamesMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool: requested } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  let pools: Pool[] = [];
  if (auth.user) {
    const { data } = await supabase
      .from("pools")
      .select("id,title,lottery")
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });
    pools = (data ?? []) as Pool[];
  }

  const active = pools.find((pool) => pool.id === requested) ?? pools[0] ?? null;
  const suffix = active ? `?pool=${encodeURIComponent(active.id)}` : "";

  return (
    <main className="shell">
      <Link className="back" href={active ? `/?pool=${encodeURIComponent(active.id)}` : "/"}>
        ← Voltar
      </Link>

      <section className="section">
        <p className="eyebrow">PAINEL DO ORGANIZADOR</p>
        <h1>Jogos Salvos</h1>
        <p className="muted">
          Consulte seus jogos ou faça uma conferência manual quando o resultado automático ainda não estiver disponível.
        </p>
        {pools.length > 0 && (
          <PoolSwitcher pools={pools} activeId={active?.id} basePath="/jogos-salvos" />
        )}
      </section>

      <section className="section">
        <div className="list">
          <Link className="list-item" href="/meus-jogos-salvos">
            <div>
              <strong>Meus jogos salvos</strong>
              <div className="muted">Histórico e conferência automática dos jogos deste aparelho.</div>
            </div>
            <span className="card-chevron" aria-hidden="true">›</span>
          </Link>

          <Link className="list-item" href={`/conferencia-manual${suffix}`}>
            <div>
              <strong>Conferir resultado manual</strong>
              <div className="muted">Informe modalidade, concurso e dezenas sorteadas para conferir, salvar e publicar aos participantes deste bolão.</div>
            </div>
            <span className="card-chevron" aria-hidden="true">›</span>
          </Link>
        </div>
      </section>

      <AppNav />
    </main>
  );
}
