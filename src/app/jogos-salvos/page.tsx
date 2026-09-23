import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { PoolSwitcher } from "@/components/pool-switcher";
import { createClient } from "@/lib/supabase/server";
import styles from "./jogos-salvos.module.css";

export const dynamic = "force-dynamic";

type Pool = { id: string; title: string; lottery: string };
type IconProps = { className?: string };

function ArchiveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h18v13H3z" />
      <path d="M2 4h20v4H2zM9 12h6" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="14" r="4" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function TicketIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

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
    <main className={`shell ${styles.page}`}>
      <Link className="back" href={active ? `/?pool=${encodeURIComponent(active.id)}` : "/"}>
        ← Voltar
      </Link>

      <section className={styles.hero}>
        <p className="eyebrow">PAINEL DO ORGANIZADOR</p>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}><TicketIcon /></span>
          <h1>Jogos Salvos</h1>
        </div>
        <p className={styles.intro}>
          Acesse seus jogos, leia bilhetes pela câmera e faça a conferência manual quando precisar.
        </p>
        {pools.length > 0 && (
          <div className={styles.switcherWrap}>
            <PoolSwitcher pools={pools} activeId={active?.id} basePath="/jogos-salvos" />
          </div>
        )}
      </section>

      <section className={styles.cards}>
        <Link className={`${styles.card} ${styles.cameraCard}`} href="/ler-bilhete">
          <span className={styles.icon}><CameraIcon /></span>
          <span className={styles.copy}>
            <strong>Ler bilhete com a câmera</strong>
            <span>Fotografe ou escolha uma imagem da galeria para reconhecer os jogos.</span>
          </span>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </Link>

        <Link className={styles.card} href={`/meus-jogos-salvos${suffix}`}>
          <span className={styles.icon}><ArchiveIcon /></span>
          <span className={styles.copy}>
            <strong>Meus jogos salvos</strong>
            <span>Histórico e conferência automática dos jogos deste aparelho.</span>
          </span>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </Link>

        <Link className={styles.card} href={`/conferencia-manual${suffix}`}>
          <span className={styles.icon}><CheckIcon /></span>
          <span className={styles.copy}>
            <strong>Conferir resultado manual</strong>
            <span>Informe o resultado e publique a conferência para os participantes.</span>
          </span>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </Link>
      </section>

      <AppNav />
    </main>
  );
}
