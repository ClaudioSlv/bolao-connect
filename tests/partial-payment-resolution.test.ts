import test from "node:test";
import assert from "node:assert/strict";
import {resolutionAmounts, refundRetentionForVersion} from "../src/lib/partial-payment-resolution.ts";

test("retém 15% apenas no pedido de estorno, com arredondamento em centavos", () => {
  assert.deepEqual(resolutionAmounts(8000, "refund"), {retentionCents: 1200, amountCents: 6800});
  assert.deepEqual(resolutionAmounts(8000, "credit"), {retentionCents: 0, amountCents: 8000});
  assert.deepEqual(resolutionAmounts(101, "refund"), {retentionCents: 15, amountCents: 86});
  assert.deepEqual(resolutionAmounts(8000, "refund", 0), {retentionCents: 0, amountCents: 8000});
});

test("preserva o texto de estorno integral dos bolões existentes", async () => {
  const {defaultRulesForVersion} = await import("../src/lib/pool-rules.ts");
  assert.match(defaultRulesForVersion(5), /valores já pagos serão devolvidos/);
  assert.doesNotMatch(defaultRulesForVersion(5), /retenção administrativa de 3%/);
  assert.match(defaultRulesForVersion(6), /retenção administrativa de 3%/);
});

test("preserva percentuais anteriores e aplica 15% na versão 7", async () => {
  const {defaultRulesForVersion} = await import("../src/lib/pool-rules.ts");
  assert.equal(refundRetentionForVersion(5), 0);
  assert.equal(refundRetentionForVersion(6), 3);
  assert.equal(refundRetentionForVersion(7), 15);
  assert.deepEqual(resolutionAmounts(10000, "refund", refundRetentionForVersion(7)), {retentionCents:1500, amountCents:8500});
  assert.match(defaultRulesForVersion(7), /retenção administrativa de 15%/);
  assert.match(defaultRulesForVersion(7), /85% restantes/);
});
