import assert from "node:assert/strict";
import test from "node:test";
import {
  groupReceiptsByModality,
  receiptModality,
} from "../src/lib/receipt-modality.ts";

test("identifica modalidade pelo título do comprovante", () => {
  assert.equal(receiptModality("Comprovante - Lotofácil 3780"), "Lotofácil");
  assert.equal(receiptModality("Comprovante - Mega da Virada 2026"), "Mega-Sena");
  assert.equal(receiptModality("Comprovante - +Milionária 389"), "+Milionária");
});

test("separa comprovantes por modalidade", () => {
  const groups = groupReceiptsByModality([
    { title: "Comprovante - Lotofácil 3780", id: 1 },
    { title: "Comprovante - Mega-Sena 3000", id: 2 },
    { title: "Comprovante - Lotofácil 3781", id: 3 },
  ]);
  assert.deepEqual(
    groups.map(([name, items]) => [name, items.map((item) => item.id)]),
    [
      ["Lotofácil", [1, 3]],
      ["Mega-Sena", [2]],
    ],
  );
});
