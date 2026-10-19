// Accuracy of the claim extractor on real, publicly posted retirement certificates (hand-labelled truth).
// usage: node scripts/eval_real.mjs [dir-with-claim.mjs]  (default src/domain; pass an older copy for a baseline)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = process.argv[2] ? resolve(process.argv[2]) : resolve('src/domain');
const { extractClaim } = await import(`${dir}/claim.mjs`);
const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
function score(samples) {
  let serialOk = 0, qtyOk = 0, both = 0;
  const miss = [];
  for (const s of samples) {
    const c = extractClaim(s.text);
    const got = c.serials.map((x) => x.raw);
    const sOk = s.truth_serial === null ? got.length === 0 : got.length === 1 && got[0] === s.truth_serial.toUpperCase();
    const qOk = c.quantity === s.truth_qty;
    serialOk += sOk; qtyOk += qOk; both += sOk && qOk;
    if (!sOk || !qOk) miss.push({ id: s.id, serial: sOk, quantity: qOk });
  }
  return { n: samples.length, serial: serialOk, quantity: qtyOk, both, miss };
}
const main = load('data/real/samples.json');
const held = load('data/real/heldout.json');
const out = {
  extractor: dir,
  publishers: [...new Set([...main, ...held].map((s) => s.company.replace(/ \(.*\)/, '')))],
  main: score(main),
  heldout: score(held),
};
console.log(JSON.stringify(out, null, 1));
if (!process.argv[2]) { mkdirSync('data/eval', { recursive: true }); writeFileSync('data/eval/real-results.json', JSON.stringify(out, null, 1) + '\n'); }
