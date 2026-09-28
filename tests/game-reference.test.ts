import assert from "node:assert/strict";
import test from "node:test";
import {
  gameReferenceLocation,
  withStableGameReferences,
} from "../src/lib/game-reference.ts";

test("localiza o jogo 680 no lote e bilhete corretos", () => {
  assert.deepEqual(gameReferenceLocation(680), {
    referenceNumber: 680,
    lotNumber: 7,
    ticketInLot: 8,
    positionInTicket: 10,
    overallTicket: 68,
  });
});

test("preserva referências existentes ao filtrar jogos", () => {
  const games = withStableGameReferences([
    { numbers: [1, 2, 3], referenceNumber: 680 },
    { numbers: [4, 5, 6], referenceNumber: 681 },
  ]);
  assert.equal(games.filter((game) => game.numbers.includes(2))[0].referenceNumber, 680);
});

test("adiciona referências aos jogos antigos sem alterar as dezenas", () => {
  const games = withStableGameReferences([
    { numbers: [3, 7, 12] },
    { numbers: [4, 9, 15] },
  ]);
  assert.deepEqual(games, [
    { numbers: [3, 7, 12], referenceNumber: 1 },
    { numbers: [4, 9, 15], referenceNumber: 2 },
  ]);
});
