"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

// Keep every game in data while mounting only nearby cards on mobile.
const stride = 180;
export function GameListWindow({ rows, count, renderRow, listId }: { rows?: ReactNode[]; count?: number; renderRow?: (index: number) => ReactNode; listId: string }) {
  const total = count ?? rows?.length ?? 0;
  const list = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = list.current?.getBoundingClientRect().top ?? 0;
      const first = Math.max(0, Math.floor((160 - top) / stride) - 8);
      setStart(Math.min(Math.max(0, total - 1), first));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, [total]);
  const first = Math.min(start, Math.max(0, total - 1));
  const end = Math.min(total, first + 40);
  return <div ref={list} id={listId} data-virtual-stride={stride} data-game-count={total} style={{ paddingRight: 30, height: total * stride, position: "relative" }}>
    <div style={{ position: "absolute", top: first * stride, left: 0, right: 30 }}>
      {Array.from({ length: end - first }, (_, offset) => <div key={first + offset} style={{ height: stride, paddingBottom: 10 }}>{renderRow ? renderRow(first + offset) : rows?.[first + offset]}</div>)}
    </div>
  </div>;
}
