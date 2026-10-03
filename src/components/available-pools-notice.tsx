"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LOTTERY_LABELS } from "@/lib/lottery-pricing";
import type { LotteryId } from "@/lib/domain";
import styles from "./available-pools-notice.module.css";
import { LOTTERY_COVER_IMAGES } from "./dynamic-lotofacil-cover";

type AvailablePool = { id: string; lottery: LotteryId; public_slug: string };

export function AvailablePoolsNotice({
  pools,
  participant,
}: {
  pools: AvailablePool[];
  participant: { token: string; name: string; phone: string };
}) {
  const router = useRouter();
  const [modalPool, setModalPool] = useState<AvailablePool | null>(null);
  const key = useMemo(
    () =>
      pools[0]
        ? `bolao-connect:new-pool:${participant.token}:${pools[0].id}`
        : "",
    [participant.token, pools],
  );

  useEffect(() => {
    if (!pools[0] || !key) return;
    try {
      if (localStorage.getItem(key) !== "later") setModalPool(pools[0]);
    } catch {
      setModalPool(pools[0]);
    }
  }, [key, pools]);

  if (!pools.length) return null;
  const join = (pool: AvailablePool) => {
    const query = new URLSearchParams({
      name: participant.name,
      phone: participant.phone,
    });
    router.push(`/bolao/${pool.public_slug}/entrar?${query.toString()}`);
  };
  return (
    <>
      <section className={`section card ${styles.pulse} ${styles.notice}`}>
        <div className={styles.heading}><span className={styles.badge}>NOVO</span><h2>Novo bolão disponível</h2></div>
        {pools.map((pool) => (
          <div className={`wallet-row ${styles.poolRow}`} key={pool.id}>
            <div className={styles.poolInfo}>{LOTTERY_COVER_IMAGES[pool.lottery] ? <img className={styles.cover} src={LOTTERY_COVER_IMAGES[pool.lottery]} alt="" /> : <span className={styles.lucky}>🍀</span>}<div><span className={styles.available}>CONVITE DISPONÍVEL</span><strong>{LOTTERY_LABELS[pool.lottery]}</strong></div></div>
            <button
              type="button"
              className={`button primary ${styles.joinButton}`}
              onClick={() => join(pool)}
            >
              PARTICIPAR
            </button>
          </div>
        ))}
      </section>
      {modalPool && (
        <div
          className="reminder-fixed-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Novo bolão disponível"
        >
          <div className="reminder-fixed-card">
            <p className="eyebrow">NOVO BOLÃO DISPONÍVEL</p>
            <h2>{LOTTERY_LABELS[modalPool.lottery]}</h2>
            <p className="muted">
              Deseja conhecer e confirmar sua participação?
            </p>
            <button
              type="button"
              className="button primary"
              onClick={() => join(modalPool)}
            >
              OK, QUERO PARTICIPAR
            </button>
            <button
              type="button"
              className="reminder-decline"
              onClick={() => {
                try {
                  localStorage.setItem(key, "later");
                } catch {}
                setModalPool(null);
              }}
            >
              Ver depois
            </button>
          </div>
        </div>
      )}
    </>
  );
}
