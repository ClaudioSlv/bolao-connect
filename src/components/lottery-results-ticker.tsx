"use client";

import { useEffect, useState } from "react";

type Prize = { label: string; winners: number };
type Result = { lottery: string; label: string; contest: number; drawDate: string | null; prizes: Prize[] };

const tones: Record<string, string> = {
  "mega-sena": "ticker-mega",
  lotofacil: "ticker-lotofacil",
  quina: "ticker-quina",
  "dupla-sena": "ticker-dupla",
  lotomania: "ticker-lotomania",
  timemania: "ticker-timemania",
  "dia-de-sorte": "ticker-dia",
  "super-sete": "ticker-super",
  "mais-milionaria": "ticker-milionaria",
};

function formatWinners(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function LotteryResultsTicker() {
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/lottery-ticker", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { results?: Result[] };
        if (!cancelled && Array.isArray(data.results)) setResults(data.results);
      } catch {}
    }

    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!results.length) return null;

  const items = [...results, ...results];

  return (
    <aside className="lottery-ticker" aria-label="Últimos resultados das Loterias CAIXA">
      <div className="lottery-ticker-label">Resultados CAIXA</div>
      <div className="lottery-ticker-window">
        <div className="lottery-ticker-track">
          {items.map((result, index) => (
            <div className={`lottery-ticker-item ${tones[result.lottery] ?? ""}`} key={`${result.lottery}-${index}`}>
              <strong>{result.label}</strong>
              <span>Concurso {result.contest}</span>
              {result.prizes.map((prize) => (
                <span key={`${result.lottery}-${index}-${prize.label}`}>
                  {prize.label}: <b>{formatWinners(prize.winners)}</b>
                </span>
              ))}
              <i>•</i>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
