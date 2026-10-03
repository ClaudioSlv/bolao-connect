"use client";

import { useEffect, useRef, useState } from "react";

export function GameListScrollbar({ count, listId = "generated-game-list" }: { count: number; listId?: string }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(1);
  const frame = useRef(0);

  useEffect(() => {
    const update = () => {
      frame.current = 0;
      const list = document.getElementById(listId);
      if (!list) return;
      const rect = list.getBoundingClientRect();
      setVisible(rect.top < window.innerHeight * 0.55 && rect.bottom > window.innerHeight * 0.55);
      // Read only a few rows even when the list has thousands of games.
      let low = 0;
      let high = list.children.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (list.children[middle].getBoundingClientRect().bottom < 160) low = middle + 1;
        else high = middle;
      }
      setCurrent(low + 1);
    };
    const schedule = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [count, listId]);

  if (count < 2 || !visible) return null;
  return (
    <aside className="game-list-scrollbar" aria-label="Navegação rápida pelos jogos">
      <span className="game-list-scrollbar-counter">{current.toLocaleString("pt-BR")} / {count.toLocaleString("pt-BR")}</span>
      <input
        type="range"
        min={1}
        max={count}
        step={1}
        value={Math.min(current, count)}
        aria-label="Ir para o jogo"
        aria-valuetext={`Jogo ${current} de ${count}`}
        onChange={(event) => {
          const next = Number(event.target.value);
          setCurrent(next);
          const row = document.getElementById(listId)?.children[next - 1];
          if (row) window.scrollBy({ top: row.getBoundingClientRect().top - 160, behavior: "instant" });
        }}
      />
    </aside>
  );
}
