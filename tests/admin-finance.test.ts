import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMoneyToCents,
  paymentPosition,
  splitPrize,
} from "../src/lib/admin-finance.ts";

test("converte valores brasileiros em centavos", () => {
  assert.equal(parseMoneyToCents("301,50"), 30150);
  assert.equal(parseMoneyToCents("1.234,56"), 123456);
});
test("divide prêmio por cotas sem perder centavos", () => {
  const result = splitPrize(10001, [
    { id: "a", shares: 1 },
    { id: "b", shares: 2 },
  ]);
  assert.deepEqual(
    result.map((r) => r.amountCents),
    [3333, 6668],
  );
  assert.equal(
    result.reduce((sum, r) => sum + r.amountCents, 0),
    10001,
  );
});
test("calcula pagamento pendente, parcial e quitado", () => {
  assert.equal(paymentPosition(10000, 0).status, "pending");
  assert.deepEqual(paymentPosition(10000, 4000), {
    received: 4000,
    due: 6000,
    status: "partial",
  });
  assert.equal(paymentPosition(10000, 10000).status, "confirmed");
});
