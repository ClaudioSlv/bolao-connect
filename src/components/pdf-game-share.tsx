"use client";

import { useEffect } from "react";
import { shareGamesPdf } from "@/lib/game-pdf";

export function PdfGameShare() {
  useEffect(() => {
    const handler = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement)?.closest("button");
      if (button?.dataset.shareGames === "memory") return;
      if (!button || !button.textContent?.includes("COMPARTILHAR JOGO")) return;

      const area = document.getElementById("generated-games");
      if (!area) return;
      const rows = [...area.querySelectorAll(".list-item")].map((element, index) => {
        const reference = Number((element as HTMLElement).dataset.gameReference) || index + 1;
        const text = (element.textContent || "").replace(/^Jogo\s*\d+/i, "").trim();
        return `Jogo ${reference}: ${text}`;
      });
      if (!rows.length) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        const heading = document.querySelector("main h1")?.textContent || "Jogos gerados";
        await shareGamesPdf(heading, rows);
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          alert("Nao foi possivel compartilhar o PDF neste aparelho.");
        }
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
