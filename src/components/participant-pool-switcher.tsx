"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DynamicLotofacilCover } from "@/components/dynamic-lotofacil-cover";

type ParticipantPool = {
  id: string;
  title: string;
  lottery: string;
  accessToken: string;
  coverImageUrl: string | null;
  contestNumber: number | null;
  drawAt: string | null;
  estimatedPrizeCents: number | null;
  status: string | null;
};

export function ParticipantPoolSwitcher({
  pools,
  currentPoolId,
}: {
  pools: ParticipantPool[];
  currentPoolId: string;
}) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const navigatingRef = useRef(false);

  useEffect(() => {
    navigatingRef.current = false;
    const active = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [currentPoolId]);

  if (pools.length < 2) return null;

  const currentIndex = pools.findIndex((pool) => pool.id === currentPoolId);
  const openAdjacentPool = (direction: -1 | 1) => {
    const nextIndex = Math.min(pools.length - 1, Math.max(0, currentIndex + direction));
    if (nextIndex !== currentIndex && !navigatingRef.current) {
      navigatingRef.current = true;
      router.push(`/p/${pools[nextIndex].accessToken}`);
    }
  };

  return (
    <section className="section participant-pool-switcher">
      <h2>Meus bolões</h2>
      <p className="muted">Selecione o bolão que deseja acompanhar.</p>
      <nav
        ref={listRef}
        className="participant-pool-list"
        aria-label="Bolões em que participo"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const distance = event.changedTouches[0]?.clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(distance) < 60) return;
          openAdjacentPool(distance < 0 ? 1 : -1);
        }}
      >
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
              {pool.lottery === "lotofacil" && Number(pool.contestNumber) % 20 === 0 ? (
                <DynamicLotofacilCover contestNumber={pool.contestNumber} drawAt={pool.drawAt} estimatedPrizeCents={pool.estimatedPrizeCents} status={pool.status} compact />
              ) : pool.coverImageUrl ? (
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
