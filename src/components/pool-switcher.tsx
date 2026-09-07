import Link from "next/link";

type Pool = { id: string; title: string; lottery?: string };

export function PoolSwitcher({ pools, activeId, basePath }: { pools: Pool[]; activeId?: string | null; basePath: string }) {
  if (pools.length < 2) return null;
  return <div className="pool-switcher"><strong>Bolão ativo:</strong><div className="actions">{pools.map((pool)=><Link key={pool.id} className={`button ${pool.id===activeId?"primary":"secondary"}`} href={`${basePath}?pool=${encodeURIComponent(pool.id)}`}>{pool.title}</Link>)}</div></div>;
}
