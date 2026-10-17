import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSerial, findSerials } from '../../src/domain/serial.mjs';

const GS = 'GS1-1-MZ-GS7643-16-2025-31135-1059-34189';
const VCU = '7456-198346632-198348830-VCU-044-MER-IN-14-1788-01012019-31122019-0';

test('parses a Gold Standard serial into a range', () => {
  const s = parseSerial(GS);
  assert.equal(s.registry, 'GOLD_STANDARD');
  assert.equal(s.project, 'GS7643');
  assert.equal(s.country, 'MZ');
  assert.equal(s.vintage, 2025);
  assert.equal(s.batch, 31135);
  assert.equal(s.start, 1059);
  assert.equal(s.end, 34189);
  assert.equal(s.quantity, 33131);
  assert.equal(s.batchKey, 'GOLD_STANDARD:GS7643:2025:31135');
});

test('parses a Verra VCU serial (parse only)', () => {
  const s = parseSerial(VCU);
  assert.equal(s.registry, 'VERRA');
  assert.equal(s.start, 198346632);
  assert.equal(s.end, 198348830);
  assert.equal(s.quantity, 2199);
  assert.equal(s.vintage, 2019);
  assert.equal(s.batchKey, 'VERRA:1788:2019:7456');
});

test('returns null for text that is not a serial', () => {
  assert.equal(parseSerial('hello'), null);
  assert.equal(parseSerial(''), null);
  assert.equal(parseSerial(null), null);
});

test('rejects a range whose end is before its start', () => {
  assert.equal(parseSerial('GS1-1-MZ-GS7643-16-2025-31135-500-100'), null);
});

test('is case-insensitive and normalises unicode hyphens', () => {
  const s = parseSerial('gs1‑1–mz—gs7643-16-2025-31135-1059-34189');
  assert.equal(s.raw, GS);
});

test('finds several serials in one sentence, in order, without duplicates', () => {
  const t = `Retired ${GS}, then ${VCU} and again ${GS}.`;
  const found = findSerials(t);
  assert.deepEqual(found.map(x => x.registry), ['GOLD_STANDARD', 'VERRA']);
});

test('finds a serial that ends a sentence with a full stop', () => {
  assert.equal(findSerials(`See serial ${GS}.`).length, 1);
});

test('finds nothing in a sentence without serials', () => {
  assert.deepEqual(findSerials('We are carbon neutral since 2020.'), []);
});

test('single credit range has quantity 1', () => {
  assert.equal(parseSerial('GS1-1-MZ-GS7643-16-2025-31135-7-7').quantity, 1);
});
