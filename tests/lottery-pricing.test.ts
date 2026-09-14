import assert from "node:assert/strict";
import test from "node:test";
import { officialGameCostCents } from "../src/lib/lottery-pricing.ts";

const numbers = (amount: number) =>
  Array.from({ length: amount }, (_, index) => index + 1);

test("calcula apostas simples pelos preços oficiais", () => {
  assert.equal(officialGameCostCents("lotofacil", { numbers: numbers(15) }), 350);
  assert.equal(officialGameCostCents("mega-sena", { numbers: numbers(6) }), 600);
  assert.equal(officialGameCostCents("quina", { numbers: numbers(5) }), 300);
});

test("calcula apostas múltiplas pela quantidade de combinações", () => {
  assert.equal(officialGameCostCents("lotofacil", { numbers: numbers(16) }), 5_600);
  assert.equal(officialGameCostCents("lotofacil", { numbers: numbers(17) }), 47_600);
  assert.equal(officialGameCostCents("mega-sena", { numbers: numbers(7) }), 4_200);
});

test("combina números e trevos da Mais Milionária", () => {
  assert.equal(
    officialGameCostCents("mais-milionaria", {
      numbers: numbers(6),
      trevos: numbers(3),
    }),
    1_800,
  );
});
