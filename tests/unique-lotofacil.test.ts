import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueLotofacil } from '../src/lib/unique-lotofacil.ts';

test('completa 5000 jogos únicos em diferentes gerações', () => {
  for (let run = 0; run < 5; run++) {
    const sequence = uniqueLotofacil(Array.from({length:25},(_,i)=>i+1),15,5000);
    const seen = new Set<string>();
    for (let i=0;i<5000;i++) {
      const game=sequence.next()!;
      assert.equal(game.length,15);
      assert.equal(new Set(game).size,15);
      seen.add(game.join(','));
    }
    assert.equal(seen.size,5000);
    assert.equal(sequence.next(),null);
  }
});
test('respeita exclusões e completa todas as combinações disponíveis', () => {
  const numbers=Array.from({length:17},(_,i)=>i+3);
  const sequence=uniqueLotofacil(numbers,15,5000);
  assert.equal(sequence.total,136);
  const seen=new Set<string>();
  let game;
  while ((game=sequence.next())) {
    assert.ok(game.every(n=>numbers.includes(n)));
    seen.add(game.join(','));
  }
  assert.equal(seen.size,136);
});
