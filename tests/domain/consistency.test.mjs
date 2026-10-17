import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const results = JSON.parse(read('data/eval/results.json'));
const readme = read('README.md');
const count = (src, re) => (src.match(re) || []).length;

test('README numbers equal results.json', () => {
  const c = results.claims;
  assert.ok(readme.includes(`${results.records.total} (${results.records.retired} retired, ${results.records.issued} issued)`));
  assert.ok(readme.includes(`${c.total}: ${c.verdict_totals.MATCH} Match, ${c.verdict_totals.MISMATCH} Mismatch, ${c.verdict_totals.NOT_FOUND} Not found, ${c.verdict_totals.NO_SERIAL} No serial`));
  assert.ok(readme.includes(`${Math.round(c.accuracy * c.total)}/${c.total}`));
  const d = results.double_use;
  assert.ok(readme.includes(`${d.second_duplicate}/${d.pairs} full overlap, ${d.partial_overlap_duplicate}/${d.partial_overlap_tried} partial overlap`));
  const e = results.extraction.set2_heldout;
  assert.ok(readme.includes(`serial ${e.serial_recall}, quantity ${e.quantity_recall}`));
});

test('README test counts equal the number of tests in the files', () => {
  const domain = ['serial', 'claim', 'reconcile', 'ledger', 'check', 'consistency'].map((n) => count(read(`tests/domain/${n}.test.mjs`), /^test\(/gm)).reduce((a, b) => a + b, 0);
  const contract = count(read('tests/contract/registry.test.cjs'), /^\s+it\(/gm);
  assert.ok(readme.includes(`${domain} pass`), `domain tests: ${domain}`);
  assert.ok(readme.includes(`${contract} pass`), `contract tests: ${contract}`);
  assert.ok(readme.includes(`${domain} domain + ${contract} contract`));
});

test('docs/ copies of the code are identical to src/', () => {
  for (const f of ['domain/serial.mjs', 'domain/claim.mjs', 'domain/ledger.mjs', 'domain/reconcile.mjs', 'application/checkClaim.mjs', 'adapters/sampleRecords.mjs', 'adapters/goldStandardLive.mjs']) {
    assert.equal(read(`docs/src/${f}`), read(`src/${f}`), f);
  }
  assert.equal(read('docs/data/results.json'), read('data/eval/results.json'));
});

test('the sample file has at least 100 records, each with source url and fetch date', () => {
  const rows = JSON.parse(read('data/gs/credits-sample.json'));
  assert.ok(rows.length >= 100);
  assert.ok(rows.every((r) => r.source_url && r.fetched_at && r.serial_number));
});

test('domain code imports nothing from adapters or infrastructure', () => {
  for (const f of ['serial', 'claim', 'ledger', 'reconcile']) {
    const src = read(`src/domain/${f}.mjs`);
    assert.ok(!/from '\.\.\/(adapters|application)/.test(src) && !/node:/.test(src), f);
  }
});
