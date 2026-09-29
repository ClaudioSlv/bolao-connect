import test from "node:test";
import assert from "node:assert/strict";
import {resolutionAmounts} from "../src/lib/partial-payment-resolution.ts";

test("retém 3% apenas no pedido de estorno, com arredondamento em centavos", () => {
  assert.deepEqual(resolutionAmounts(8000, "refund"), {retentionCents: 240, amountCents: 7760});
  assert.deepEqual(resolutionAmounts(8000, "credit"), {retentionCents: 0, amountCents: 8000});
  assert.deepEqual(resolutionAmounts(101, "refund"), {retentionCents: 3, amountCents: 98});
});

test("preserva o texto de estorno integral dos bolões existentes", async () => {
  const {defaultRulesForVersion} = await import("../src/lib/pool-rules.ts");
  assert.match(defaultRulesForVersion(5), /valores já pagos serão devolvidos/);
  assert.doesNotMatch(defaultRulesForVersion(5), /retenção administrativa de 3%/);
  assert.match(defaultRulesForVersion(6), /retenção administrativa de 3%/);
});
