"use client";

import { useEffect, useState } from "react";
import { finalPoolDeadline, type PoolDeadlines } from "@/lib/pool-roster";

export function ClosedPoolRoster({ pool, token, poolId }: { pool: PoolDeadlines; token?: string; poolId?: string }) {
  const deadline = finalPoolDeadline(pool);
  const [closed, setClosed] = useState(() => Boolean(deadline && Date.now() > Date.parse(deadline)));
  useEffect(() => {
    if (!deadline) return;
    const check = () => setClosed(Date.now() > Date.parse(deadline));
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  if (!closed) return null;
  const query = new URLSearchParams(token ? { token } : { pool: poolId || "" });
  return <section className="section">
    <h2>Participantes confirmados</h2>
    <p className="muted">O prazo terminou. Consulte quem quitou a cota neste bolão. Novas inclusões e confirmações manuais estão bloqueadas.</p>
    <a className="button primary" href={`/api/pool-roster?${query}`} download>BAIXAR LISTA DE PARTICIPANTES CONFIRMADOS</a>
    <p className="muted">Pix realizados no prazo e confirmados depois pelo banco são identificados no documento.</p>
  </section>;
}
