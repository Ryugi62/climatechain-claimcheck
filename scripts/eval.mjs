// Reproducible experiment. Run: npm run eval  -> data/eval/results.json
import { readFileSync, writeFileSync } from 'node:fs';
import { sampleRecords } from '../src/adapters/sampleRecords.mjs';
import { checkClaim } from '../src/application/checkClaim.mjs';
import { extractClaim } from '../src/domain/claim.mjs';
import { Ledger } from '../src/domain/ledger.mjs';

const rows = JSON.parse(readFileSync(new URL('../data/gs/credits-sample.json', import.meta.url)));
const records = sampleRecords(rows);
const retired = rows.filter((r) => r.status === 'RETIRED');
const issued = rows.filter((r) => r.status !== 'RETIRED');
const fmt = (n) => n.toLocaleString('en-US');

// --- A. claims built from real registry rows (templated sentences, expected verdicts known by construction)
const cases = [];
for (const r of retired) {
  cases.push({ kind: 'match', claimant: 'A', text: `In 2025 we retired ${fmt(r.number_of_credits)} tCO2e of Gold Standard credits (serial ${r.serial_number}).`, expect: 'MATCH' });
  cases.push({ kind: 'quantity_inflated', claimant: 'A', text: `In 2025 we retired ${fmt(Math.round(r.number_of_credits * 1.1) + 1)} tCO2e (serial ${r.serial_number}).`, expect: 'MISMATCH' });
}
for (const r of issued) {
  cases.push({ kind: 'issued_not_retired', claimant: 'A', text: `We retired ${fmt(r.number_of_credits)} tCO2e, serial ${r.serial_number}.`, expect: 'MISMATCH' });
}
retired.slice(0, 40).forEach((r) => {
  const p = r.serial_number.split('-');
  p[6] = String(Number(p[6]) + 900000); // batch number that is not in the sample
  cases.push({ kind: 'unknown_serial', claimant: 'A', text: `We retired ${fmt(r.number_of_credits)} tCO2e, serial ${p.join('-')}.`, expect: 'NOT_FOUND' });
});
for (let i = 0; i < 20; i++) cases.push({ kind: 'no_serial', claimant: 'A', text: `We are carbon neutral since 202${i % 6} thanks to offsetting.`, expect: 'NO_SERIAL' });

// --- B. double use: claimant A commits, claimant B claims the same credits (full and partial overlap)
const ledger = new Ledger();
const dupResults = [];
for (const [i, r] of retired.slice(0, 60).entries()) {
  const a = await checkClaim({ text: `We retired ${fmt(r.number_of_credits)} tCO2e (serial ${r.serial_number}).`, claimant: `A${i}`, commit: true }, { records, ledger });
  const b = await checkClaim({ text: `We retired ${fmt(r.number_of_credits)} tCO2e (serial ${r.serial_number}).`, claimant: `B${i}`, commit: true }, { records, ledger });
  dupResults.push({ first: a.verdict, second: b.verdict });
}
// partial overlap: a sub-range of an already registered block
let partialDup = 0, partialTried = 0;
for (const [i, r] of retired.slice(0, 30).entries()) {
  if (r.number_of_credits < 4) continue;
  partialTried++;
  const p = r.serial_number.split('-');
  const mid = r.starting_credit_number + Math.floor(r.number_of_credits / 2);
  const sub = [...p.slice(0, 7), String(mid), String(mid + 1)].join('-');
  const res = await checkClaim({ text: `Retired 2 tCO2e, serial ${sub}.`, claimant: `C${i}` }, { records, ledger });
  if (res.verdict === 'DUPLICATE') partialDup++;
}

const run = [];
for (const c of cases) {
  const res = await checkClaim({ text: c.text, claimant: c.claimant }, { records, ledger: new Ledger() });
  run.push({ kind: c.kind, expect: c.expect, got: res.verdict });
}
const by = {};
for (const x of run) { by[x.kind] ||= { n: 0, ok: 0, verdicts: {} }; by[x.kind].n++; by[x.kind].ok += x.expect === x.got ? 1 : 0; by[x.kind].verdicts[x.got] = (by[x.kind].verdicts[x.got] || 0) + 1; }
const verdictTotals = {};
for (const x of run) verdictTotals[x.got] = (verdictTotals[x.got] || 0) + 1;

// --- C. extraction check on hand-written phrasings.
// set 1 was written before the parser; its first run (11/15 quantities, 14/14 serials) drove 4 fixes.
// set 2 (held out) was written after the fixes and run once without edits.
function extractionCheck(file) {
  const ph = JSON.parse(readFileSync(new URL(file, import.meta.url)));
  let serialHit = 0, serialTotal = 0, qtyHit = 0, qtyTotal = 0; const misses = [];
  for (const p of ph) {
    const c = extractClaim(p.text);
    const got = c.serials.map((s) => s.raw);
    for (const s of p.serials) { serialTotal++; if (got.includes(s)) serialHit++; else misses.push({ id: p.id, what: 'serial', want: s }); }
    const extra = got.filter((s) => !p.serials.includes(s));
    if (extra.length) misses.push({ id: p.id, what: 'extra_serial', got: extra });
    if (p.quantity != null) { qtyTotal++; if (c.quantity === p.quantity) qtyHit++; else misses.push({ id: p.id, what: 'quantity', want: p.quantity, got: c.quantity }); }
    else if (c.quantity != null) misses.push({ id: p.id, what: 'spurious_quantity', got: c.quantity });
  }
  return { phrasings: ph.length, serial_recall: `${serialHit}/${serialTotal}`, quantity_recall: `${qtyHit}/${qtyTotal}`, misses };
}

const results = {
  generated_at: new Date().toISOString().slice(0, 10),
  records: { total: rows.length, retired: retired.length, issued: issued.length, sources: [...new Set(rows.map((r) => r.source_url))].length, fetched_at: [...new Set(rows.map((r) => r.fetched_at))] },
  claims: { total: run.length, accuracy: run.filter((x) => x.expect === x.got).length / run.length, by_kind: by, verdict_totals: verdictTotals },
  double_use: { pairs: dupResults.length, first_match: dupResults.filter((d) => d.first === 'MATCH').length, second_duplicate: dupResults.filter((d) => d.second === 'DUPLICATE').length, partial_overlap_tried: partialTried, partial_overlap_duplicate: partialDup },
  extraction: { set1_after_fixes: extractionCheck('../data/eval/phrasings.json'), set2_heldout: extractionCheck('../data/eval/phrasings-heldout.json') },
};
writeFileSync(new URL('../data/eval/results.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
