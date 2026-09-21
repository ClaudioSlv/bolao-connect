import test from "node:test";
import assert from "node:assert/strict";
import { extractTicketGames } from "../src/lib/ticket-ocr.ts";

const lotofacil = { min: 1, max: 25 };

test("separa três jogos da Lotofácil impressos em duas linhas", () => {
  const ocr = `
    A 01 03 05 06 07 10 11 13
      14 17 19 20 23 24 25
    B 02 03 05 08 10 11 13 14
      16 17 19 20 23 24 25
    C 01 04 05 06 07 10 11 13
      16 17 19 20 23 24 25
  `;
  assert.deepEqual(extractTicketGames(ocr, lotofacil, 15), [
    [1, 3, 5, 6, 7, 10, 11, 13, 14, 17, 19, 20, 23, 24, 25],
    [2, 3, 5, 8, 10, 11, 13, 14, 16, 17, 19, 20, 23, 24, 25],
    [1, 4, 5, 6, 7, 10, 11, 13, 16, 17, 19, 20, 23, 24, 25],
  ]);
});

test("separa marcadores A, B e C mesmo quando o OCR achata o texto", () => {
  const ocr = "A 01 03 05 06 07 10 11 13 14 17 19 20 23 24 25 B 02 03 05 08 10 11 13 14 16 17 19 20 23 24 25 C 01 04 05 06 07 10 11 13 16 17 19 20 23 24 25";
  assert.equal(extractTicketGames(ocr, lotofacil, 15).length, 3);
});

test("não mistura cabeçalho ou outra aposta para completar jogo marcado", () => {
  const ocr = `CONC 3780 TOTAL 10 50
    A 01 03 05 06 07 10 11 13
      14 17 19 20 23 24 25
    B 02 03 05 08 10 11`;
  assert.deepEqual(extractTicketGames(ocr, lotofacil, 15), [
    [1, 3, 5, 6, 7, 10, 11, 13, 14, 17, 19, 20, 23, 24, 25],
  ]);
});
