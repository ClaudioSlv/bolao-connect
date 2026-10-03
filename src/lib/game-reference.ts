export type ReferencedGame = {
  numbers: number[];
  trevos?: number[];
  referenceNumber?: number;
};

export function gameReferenceLocation(referenceNumber: number) {
  if (!Number.isInteger(referenceNumber) || referenceNumber < 1 || referenceNumber > 5000)
    throw new Error("A referência do jogo deve ficar entre 1 e 5000.");

  return {
    referenceNumber,
    lotNumber: Math.floor((referenceNumber - 1) / 100) + 1,
    ticketInLot: Math.floor(((referenceNumber - 1) % 100) / 10) + 1,
    positionInTicket: ((referenceNumber - 1) % 10) + 1,
    overallTicket: Math.floor((referenceNumber - 1) / 10) + 1,
  };
}

export function withStableGameReferences<T extends ReferencedGame>(games: T[]) {
  const used = new Set<number>();

  return games.map((game, index) => {
    const stored = Number(game.referenceNumber);
    const referenceNumber =
      Number.isInteger(stored) && stored >= 1 && stored <= 5000 && !used.has(stored)
        ? stored
        : index + 1;
    used.add(referenceNumber);
    return { ...game, referenceNumber };
  });
}

export function formatGameReference(referenceNumber: number) {
  const location = gameReferenceLocation(referenceNumber);
  return `Lote ${String(location.lotNumber).padStart(2, "0")} · Bilhete ${String(location.ticketInLot).padStart(2, "0")} · posição ${location.positionInTicket}`;
}
