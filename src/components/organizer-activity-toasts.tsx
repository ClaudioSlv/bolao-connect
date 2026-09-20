"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Activity = { id: string; event_type: "participant_app_opened" | "personal_game_prize"; details: { participant_name?: string; hits?: number } | null; created_at: string };
const DISPLAY_MS = 3000;
const POLL_MS = 2500;

function activityMessage(activity: Activity) {
  const name = activity.details?.participant_name?.trim() || "Participante";
  if (activity.event_type === "personal_game_prize") {
    const hits = Number(activity.details?.hits ?? 0);
    return { name, message: ` acertou ${hits} ponto${hits === 1 ? "" : "s"}.` };
  }
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(activity.created_at));
  return { name, message: ` entrou no app às ${time}.` };
}

export function OrganizerActivityToasts({ startedAt }: { startedAt: string }) {
  const [queue, setQueue] = useState<Activity[]>([]);
  const [current, setCurrent] = useState<Activity | null>(null);
  const cursorRef = useRef(startedAt);
  const seenRef = useRef(new Set<string>());
  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/activity?since=${encodeURIComponent(cursorRef.current)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { activities?: Activity[] };
      const fresh = (payload.activities ?? []).filter((activity) => {
        if (seenRef.current.has(activity.id)) return false;
        seenRef.current.add(activity.id);
        return true;
      });
      if (!fresh.length) return;
      cursorRef.current = fresh[fresh.length - 1].created_at;
      setQueue((previous) => [...previous, ...fresh]);
    } catch {
      // A próxima consulta tenta novamente sem interromper o painel.
    }
  }, []);
  useEffect(() => { void poll(); const interval = window.setInterval(() => void poll(), POLL_MS); return () => window.clearInterval(interval); }, [poll]);
  useEffect(() => { if (current || !queue.length) return; const [next, ...rest] = queue; setCurrent(next); setQueue(rest); }, [current, queue]);
  useEffect(() => { if (!current) return; const timeout = window.setTimeout(() => setCurrent(null), DISPLAY_MS); return () => window.clearTimeout(timeout); }, [current]);
  const text = current ? activityMessage(current) : null;
  return <div className="organizer-activity-region" aria-live="polite" aria-atomic="true">{current && text ? <div className="organizer-activity-toast" role="status"><span className="organizer-activity-icon" aria-hidden="true">{current.event_type === "personal_game_prize" ? "🏆" : "👤"}</span><span><strong className="organizer-activity-name">{text.name}</strong><span className="organizer-activity-message">{text.message}</span></span></div> : null}</div>;
}
