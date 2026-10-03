import test from "node:test";
import assert from "node:assert/strict";
import { savedGameContest } from "../src/lib/saved-game-contest.ts";
test("saving accepts an explicit contest even without the CAIXA cache", () => {
  assert.equal(savedGameContest({requested:3795,latest:null,lottery:"lotofacil"}),3795);
  assert.equal(savedGameContest({requested:3800,latest:3795,lottery:"lotofacil"}),3800);
});
test("fallback uses the matching pool, never guessing contest 1 or another modality", () => {
  assert.equal(savedGameContest({requested:null,latest:null,lottery:"lotofacil",poolLottery:"lotofacil",poolContest:3800}),3800);
  assert.equal(savedGameContest({requested:null,latest:3795,lottery:"lotofacil",poolLottery:"lotofacil",poolContest:3800}),3796);
  assert.equal(savedGameContest({requested:null,latest:null,lottery:"quina",poolLottery:"lotofacil",poolContest:3800}),null);
  assert.equal(savedGameContest({requested:-1,latest:null,lottery:"lotofacil"}),null);
  assert.equal(savedGameContest({requested:1.5,latest:null,lottery:"lotofacil"}),null);
});
