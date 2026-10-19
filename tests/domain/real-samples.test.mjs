import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractClaim } from '../../src/domain/claim.mjs';
import { parseSerial } from '../../src/domain/serial.mjs';

const samples = JSON.parse(readFileSync(new URL('../../data/real/samples.json', import.meta.url), 'utf8'));

test('real-report sample set: at least 10 hand-labelled samples from at least 5 publishers', () => {
  assert.ok(samples.length >= 10);
  assert.ok(new Set(samples.map((s) => s.company)).size >= 5);
});

test('hand-labelled truth is internally consistent: serial range size equals stated quantity', () => {
  for (const s of samples) {
    const p = parseSerial(s.truth_serial);
    assert.ok(p, `truth serial parses: ${s.id}`);
    assert.equal(p.quantity, s.truth_qty, s.id);
  }
});

test('extractor reads serial and quantity from every real sentence', () => {
  for (const s of samples) {
    const c = extractClaim(s.text);
    assert.equal(c.serials.length, 1, `${s.id}: one serial`);
    assert.equal(c.serials[0].raw, s.truth_serial.toUpperCase(), `${s.id}: serial`);
    assert.equal(c.quantity, s.truth_qty, `${s.id}: quantity`);
  }
});

// Held-out file: collected after the extractor was frozen. The first run found a real PDF text artefact
// (a line break leaves "PE -14" inside a serial); a failing test was written before the fix.
const heldout = JSON.parse(readFileSync(new URL('../../data/real/heldout.json', import.meta.url), 'utf8'));
test('held-out sentences: serial (or none) and quantity match the labels', () => {
  for (const s of heldout) {
    const c = extractClaim(s.text);
    if (s.truth_serial === null) assert.equal(c.serials.length, 0, `${s.id}: no serial`);
    else {
      assert.equal(c.serials.length, 1, `${s.id}: one serial`);
      assert.equal(c.serials[0].raw, s.truth_serial.toUpperCase(), `${s.id}: serial`);
    }
    assert.equal(c.quantity, s.truth_qty, `${s.id}: quantity`);
  }
});
