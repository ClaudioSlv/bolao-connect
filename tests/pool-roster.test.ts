import test from "node:test";
import assert from "node:assert/strict";
import { finalPoolDeadline, rosterAvailable, participantDeadline, verifiedPixPaidAt } from "../src/lib/pool-roster.ts";
import { makePoolRosterPdf } from "../src/lib/pool-roster-pdf.ts";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
const normal = "2026-10-03T19:00:00Z", waiting = "2026-10-04T19:00:00Z";
test("roster stays hidden until the final waitlist deadline and each card uses its own cutoff", () => {
  const pool = { payment_deadline: normal, waitlist_payment_deadline: waiting };
  assert.equal(finalPoolDeadline(pool), waiting);
  assert.equal(rosterAvailable(pool, Date.parse(normal) + 1), false);
  assert.equal(rosterAvailable(pool, Date.parse(waiting)), false);
  assert.equal(rosterAvailable(pool, Date.parse(waiting) + 1), true);
  assert.equal(participantDeadline(pool, { status: "confirmed" }), normal);
  assert.equal(participantDeadline(pool, { status: "waitlisted" }), waiting);
  assert.equal(participantDeadline(pool, { payment_deadline_override: waiting }), waiting);
  assert.equal(rosterAvailable({ payment_deadline: null }), false);
});
test("bank timestamp requires every Pix timestamp, taking the last transfer for settlement", () => {
  const now = Date.parse(waiting);
  assert.equal(verifiedPixPaidAt([], now), null);
  assert.equal(verifiedPixPaidAt([{ horario: normal }, {}], now), null);
  assert.equal(verifiedPixPaidAt([{ horario: "invalid" }], now), null);
  assert.equal(verifiedPixPaidAt([{ horario: "2027-01-01" }], now), null);
  assert.equal(verifiedPixPaidAt([{ horario: normal }, { horario: "2026-10-03T19:01:00Z" }], now), "2026-10-03T19:01:00.000Z");
});
test("PDF fits a full list across A4 pages and handles names and bank reconciliation notes", async () => {
  const roster = { pool_id: "00000000-0000-0000-0000-000000000001", title: "Lotofácil - concurso 3800", lottery: "lotofacil", contest_number: 3800, payment_deadline: normal, closed_at: waiting };
  const entries = Array.from({ length: 100 }, (_, i) => ({ participant_id: String(i), name: `Cláudio ${i} ${"Nome comprido ".repeat(5)}`, shares: 1, recorded_at: waiting, late_bank_confirmation: i === 99 }));
  const bytes = await makePoolRosterPdf(roster, entries, "a".repeat(64), await readFile(new URL("../public/juntasorte-icon-512.png", import.meta.url)));
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() > 1);
  for (const page of doc.getPages()) { assert.equal(page.getWidth(), 595.28); assert.equal(page.getHeight(), 841.89); }
});
