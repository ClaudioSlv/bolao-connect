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

 test("localiza todas as referências de um fechamento de 5000 jogos", () => {
  const games = withStableGameReferences(Array.from({ length: 5000 }, () => ({ numbers: [1, 2, 3] })));
  for (const game of games) assert.equal(gameReferenceLocation(game.referenceNumber).referenceNumber, game.referenceNumber);
  assert.deepEqual(gameReferenceLocation(5000), { referenceNumber: 5000, lotNumber: 50, ticketInLot: 10, positionInTicket: 10, overallTicket: 500 });
  assert.equal(withStableGameReferences([{ numbers: [1], referenceNumber: 4999 }])[0].referenceNumber, 4999);
  assert.throws(() => gameReferenceLocation(5001));
});
