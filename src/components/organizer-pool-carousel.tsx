"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ORGANIZER_ACTIVE_POOL_COOKIE } from "@/lib/active-pool-cookie";

export function OrganizerPoolCarousel({
  activePoolId,
  children,
}: {
  activePoolId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingRef = useRef(false);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      `[data-pool-id="${CSS.escape(activePoolId)}"]`,
    );
    active?.scrollIntoView({ block: "nearest", inline: "start" });
  }, [activePoolId]);

  const selectVisiblePool = () => {
    if (!listRef.current || navigatingRef.current) return;
    const listBox = listRef.current.getBoundingClientRect();
    const center = listBox.left + listBox.width / 2;
    const cards = [...listRef.current.querySelectorAll<HTMLElement>("[data-pool-id]")];
    const nearest = cards.reduce<HTMLElement | null>((best, card) => {
      if (!best) return card;
      const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
      const bestCenter = best.getBoundingClientRect().left + best.offsetWidth / 2;
      return Math.abs(cardCenter - center) < Math.abs(bestCenter - center) ? card : best;
    }, null);
    const poolId = nearest?.dataset.poolId;
    if (!poolId || poolId === activePoolId) return;
    navigatingRef.current = true;
    document.cookie = `${ORGANIZER_ACTIVE_POOL_COOKIE}=${encodeURIComponent(poolId)}; Max-Age=31536000; Path=/; SameSite=Lax`;
    router.push(`/?pool=${encodeURIComponent(poolId)}`);
  };

  return (
    <div
      ref={listRef}
      className="pool-carousel"
      role="region"
      aria-label="Meus bolões — deslize para selecionar"
      onScroll={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(selectVisiblePool, 180);
      }}
      onTouchEnd={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(selectVisiblePool, 180);
      }}
    >
      {children}
    </div>
  );
}
