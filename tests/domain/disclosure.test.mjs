import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MATCH_LIMIT, wordingErrorTitle } from '../../src/domain/disclosure.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

test('G28 the Match limit line says not an audit and Gold Standard only', () => {
  assert.equal(MATCH_LIMIT, 'Not an audit · Gold Standard record only');
});

test('G29 wording box title carries both error counts computed from the measurement', () => {
  const n = JSON.parse(read('docs/data/narrative.json'));
  assert.equal(wordingErrorTitle(n), 'changes caught 10/36 · false alarms 1/36');
  assert.equal(wordingErrorTitle({ changed: { n: 4, may_conflict: 1 }, match: { n: 8, may_conflict: 0 } }), 'changes caught 1/4 · false alarms 0/8');
  assert.ok(read('docs/NARRATIVE_EVAL.md').includes('27.8% (10/36)') && read('docs/NARRATIVE_EVAL.md').includes('2.8% (1/36)'));
});

test('G28/G29 the page code uses both texts and the code copy equals src', () => {
  const app = read('docs/app.js');
  assert.ok(app.includes('MATCH_LIMIT') && app.includes('wordingErrorTitle'));
  assert.ok(read('docs/index.html').includes('changes caught 10/36'));
  // r4 H7: with live lookup on, a no-serial sentence is said to be checked by company name, not "nothing to verify"
  assert.match(app, /WHY_NO_SERIAL_COMPANY = 'No serial in the sentence, so it is checked by company name instead/);
  assert.equal(read('docs/src/domain/disclosure.mjs'), read('src/domain/disclosure.mjs'));
});

test('G30 the printed harm numbers are in docs and README, and recompute from the stored runs', () => {
  const rows = [];
  for (const f of ['data/reports/beneficiary-results.json', 'data/reports2/results.json']) {
    for (const r of JSON.parse(read(f)).rows) for (const x of r.results || []) if (x.result.claimed) rows.push([x.result.claimed, x.result.total || 0]);
  }
  const A = rows.reduce((a, [c]) => a + c, 0);
  const B = rows.reduce((a, [c, t]) => a + Math.min(c, t), 0);
  const txt = read('docs/IMPACT_NUMBERS.txt');
  const f = (v) => v.toLocaleString('en-US');
  for (const needle of [`N=${rows.length} `, `A=${f(A)} `, `B=${f(B)} `, `C=${f(A - B)} `]) assert.ok(txt.includes(needle), needle);
  const readme = read('README.md');
  for (const v of [f(A), f(B), f(A - B)]) assert.ok(readme.includes(v), v);
});

test('G30 the README first screen is short: a limit line and at most 5 evidence numbers in the evidence line', () => {
  const lines = read('README.md').split('\n');
  const ev = lines.slice(0, 12).find((l) => l.startsWith('Evidence:'));
  assert.ok(ev, 'Evidence line in first 12 lines');
  const bare = ev.replace(/\]\([^)]*\)/g, ']').replace(/`[^`]*`/g, '');
  assert.ok((bare.match(/\d[\d,]*(?:\/\d[\d,]*)?/g) || []).length <= 5, bare);
  assert.ok(lines.slice(0, 12).some((l) => l.startsWith('Limit:') && l.includes('Gold Standard')));
  assert.ok(lines.slice(0, 12).some((l) => l.includes('sepolia.etherscan.io/tx/')));
});

test('G31 the Inflated example inflates the same record as the Match example (36,445 against 33,131), so the demo shows one record', () => {
  const app = read('docs/app.js');
  assert.ok(app.includes("Math.round(a.number_of_credits * 1.1) + 1"));
  assert.ok(app.includes("(serial ${a.serial_number}).`,\n    'Not retired'"));
  assert.equal(Math.round(33131 * 1.1) + 1, 36445);
});
