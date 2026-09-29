import test from "node:test";
import assert from "node:assert/strict";
import { maxInstallments } from "../src/lib/payment-installments.ts";

test("installment choices follow the agreed R$40 rounding rule", () => {
  assert.equal(maxInstallments(3_500), 2);
  assert.equal(maxInstallments(4_000), 2);
  assert.equal(maxInstallments(8_000), 2);
  assert.equal(maxInstallments(8_001), 3);
  assert.equal(maxInstallments(13_100), 4);
  assert.equal(maxInstallments(35_000), 9);
});
