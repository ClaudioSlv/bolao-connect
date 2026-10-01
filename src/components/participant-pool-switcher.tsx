"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DynamicLotteryCover } from "@/components/dynamic-lotofacil-cover";

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
  const [unavailable, setUnavailable] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);

  useEffect(() => {
    navigatingRef.current = false;
    const active = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [currentPoolId]);

  const modalities = ["mega-sena","lotofacil","quina","dupla-sena","mais-milionaria","timemania","lotomania","dia-de-sorte","super-sete"] as const;
  const joinedModalities = new Set(pools.map((pool) => pool.lottery));
  const missingModalities = modalities.filter((lottery) => !joinedModalities.has(lottery));
  const totalSlides = pools.length + missingModalities.length;
  const syncDots = () => {
    const list = listRef.current;
    if (!list) return;
    const cards = [...list.querySelectorAll<HTMLElement>(".participant-pool-option")];
    const center = list.getBoundingClientRect().left + list.clientWidth / 2;
    let best = 0, distance = Infinity;
    cards.forEach((card, index) => {
      const box = card.getBoundingClientRect();
      const d = Math.abs(box.left + box.width / 2 - center);
      if (d < distance) { distance = d; best = index; }
    });
    setVisibleIndex(best);
  };

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
      <p className="muted">Selecione o bolão que deseja acompanhar. Deslize para o lado para ver os demais.</p>
      <nav
        ref={listRef}
        className="participant-pool-list"
        aria-label="Bolões em que participo"
        onScroll={syncDots}
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
                <DynamicLotteryCover lottery={pool.lottery as any} contestNumber={pool.contestNumber} drawAt={pool.drawAt} estimatedPrizeCents={pool.estimatedPrizeCents} status={pool.status} compact />
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
        {missingModalities.map((lottery) => (
          <button
            key={lottery}
            type="button"
            className="participant-pool-option"
            onClick={() => {
              setUnavailable(true);
              window.setTimeout(() => setUnavailable(false), 2600);
            }}
            aria-label={`${lottery}: ainda não há bolão disponível`}
          >
            <DynamicLotteryCover lottery={lottery as any} contestNumber={null} drawAt={null} status="draft" compact />
          </button>
        ))}
      </nav>
      <div aria-label="Posição no carrossel" style={{display:"flex",justifyContent:"center",gap:7,marginTop:10}}>
        {Array.from({length:totalSlides},(_,index)=><span key={index} aria-hidden="true" style={{width:index===visibleIndex?18:7,height:7,borderRadius:999,background:index===visibleIndex?"#f7c948":"rgba(255,255,255,.35)",transition:"all .2s ease"}} />)}
      </div>
      {unavailable && (
        <div
          role="status"
          style={{
            position:"fixed",left:"50%",top:"50%",transform:"translate(-50%,-50%)",
            zIndex:1000,maxWidth:360,width:"calc(100% - 40px)",padding:"22px 18px",
            border:"1px solid #f7c948",borderRadius:18,background:"rgba(8,10,12,.96)",
            color:"#fff",fontWeight:800,fontSize:18,textAlign:"center",
            boxShadow:"0 12px 40px rgba(0,0,0,.55)"
          }}
        >
          Ainda não há bolão disponível para essa modalidade.
        </div>
      )}
    </section>
  );
}
