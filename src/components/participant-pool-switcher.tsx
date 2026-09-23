import Link from "next/link";

type ParticipantPool = {
  id: string;
  title: string;
  lottery: string;
  accessToken: string;
  coverImageUrl: string | null;
};

export function ParticipantPoolSwitcher({
  pools,
  currentPoolId,
}: {
  pools: ParticipantPool[];
  currentPoolId: string;
}) {
  if (pools.length < 2) return null;

  return (
    <section className="section participant-pool-switcher">
      <h2>Meus bolões</h2>
      <p className="muted">Selecione o bolão que deseja acompanhar.</p>
      <nav className="participant-pool-list" aria-label="Bolões em que participo">
        {pools.map((pool) => {
          const active = pool.id === currentPoolId;
          return (
            <Link
              key={pool.id}
              href={`/p/${pool.accessToken}`}
              className={`participant-pool-option${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
              prefetch={false}
            >
              {pool.coverImageUrl ? (
                <img src={pool.coverImageUrl} alt="" />
              ) : (
                <span className="participant-pool-mark" aria-hidden="true">🍀</span>
              )}
              <span>
                <strong>{pool.title}</strong>
                <small>{pool.lottery}{active ? " · Selecionado" : ""}</small>
              </span>
              <b aria-hidden="true">›</b>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

