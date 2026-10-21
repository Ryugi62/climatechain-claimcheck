import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const res = JSON.parse(read('data/reports2/results.json'));
const armB = JSON.parse(read('data/reports2/armB-united-internet.json'));
const readme = read('README.md');
const doc = read('docs/REAL_SENTENCE_HUNT.md');

test('S18 the wider sample has at least 30 first-time reports, none of the first 10', () => {
  assert.ok(res.reports >= 30);
  const first10 = JSON.parse(read('data/reports/manifest.json')).map((m) => m.url);
  const urls = JSON.parse(read('data/reports2/manifest.json')).map((m) => m.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const u of urls) assert.ok(!first10.includes(u));
});

test('S18 README and docs state the measured counts of the wider sample', () => {
  const line = `${res.sentence_quantity_equal} of ${res.reports} have a candidate total equal to the sentence`;
  assert.ok(readme.includes(line), line);
  assert.ok(doc.includes(line), line);
  assert.ok(readme.includes(`${res.with_sentence} of ${res.reports} reports contain a retirement sentence`));
  assert.ok(doc.includes('docs/REAL_SENTENCE_HUNT.md') === false);
});

test('S18 arm B: the real United Internet sentence equals one Gold Standard record under 1&1 Versatel, and README says it came from a search, not from the sample', () => {
  assert.equal(armB.runs['1&1 Versatel'].status, 'MATCH');
  assert.equal(armB.runs['1&1 Versatel'].total, 4713);
  assert.equal(armB.runs['United Internet'].status, 'NOT_FOUND');
  assert.ok(/found by a targeted search/i.test(readme));
  assert.ok(readme.includes('GS1-1-KE-GS11200-16-2022-25937-944-5656'));
});
