// Measures the sentence-without-serial path on the 10 real reports (data/reports/sentences.json).
// Live: asks the Gold Standard public endpoint once per company (paged, 2 s apart); answers are cached in
// data/reports/gs-beneficiary-cache.json so the table can be re-made offline. Output: data/reports/beneficiary-results.json
import fs from 'node:fs';
import { checkBeneficiary } from '../src/application/checkBeneficiary.mjs';
import { goldStandardLive } from '../src/adapters/goldStandardLive.mjs';

const CACHE = 'data/reports/gs-beneficiary-cache.json';
const offline = process.argv.includes('--offline');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const slow = async (url, init) => { await new Promise((r) => setTimeout(r, 2000)); return fetch(url, init); };
const live = goldStandardLive(slow, { headers: { 'User-Agent': 'Mozilla/5.0 (claimcheck research sample)' } });
const registry = {
  async findByEntity(name) {
    if (cache[name]) return cache[name].records;
    if (offline) throw new Error('not cached (offline run)');
    const records = await live.findByEntity(name);
    cache[name] = { fetched_at: new Date().toISOString().slice(0, 16) + 'Z', records };
    fs.writeFileSync(CACHE, JSON.stringify(cache));
    return records;
  },
};

const spec = JSON.parse(fs.readFileSync('data/reports/sentences.json', 'utf8'));
const prevalence = JSON.parse(fs.readFileSync('data/reports/manifest.json', 'utf8'));
const rows = [];
for (const m of prevalence) {
  const claimant = spec.claimants[m.id];
  const sents = spec.sentences.filter((s) => s.report === m.id);
  const company = await checkBeneficiary({ text: `${claimant} retired credits.`, claimant }, { registry }); // company-only probe: quantity-free
  const results = [];
  for (const s of sents) results.push({ text: s.text, result: await checkBeneficiary({ text: s.text, claimant }, { registry }) });
  rows.push({ id: m.id, publisher: m.publisher, claimant, sentences: sents.length, company_probe: { status: company.status, candidates: company.candidates.length, total: company.total, allCandidates: company.allCandidates ?? company.candidates.length }, results });
}
const sum = (f) => rows.filter(f).length;
const out = {
  measured: new Date().toISOString().slice(0, 10), reports: rows.length,
  with_sentence: sum((r) => r.sentences > 0),
  sentence_with_candidates: sum((r) => r.results.some((x) => x.result.candidates.length > 0)),
  sentence_quantity_equal: sum((r) => r.results.some((x) => x.result.status === 'MATCH')),
  company_has_gs_records: sum((r) => r.company_probe.candidates > 0),
  rows,
};
fs.writeFileSync('data/reports/beneficiary-results.json', JSON.stringify(out, null, 1) + '\n');
console.log(`reports ${out.reports} | with a retirement sentence ${out.with_sentence} | sentence + candidates ${out.sentence_with_candidates} | quantity equal ${out.sentence_quantity_equal} | company has GS retired records ${out.company_has_gs_records}`);
for (const r of rows) console.log(r.id.padEnd(18), 'probe', r.company_probe.status.padEnd(12), 'cand', String(r.company_probe.candidates).padStart(3), 'total', String(r.company_probe.total).padStart(8), '| sentences', r.sentences, r.results.map((x) => `${x.result.status}${x.result.relation ? ':' + x.result.relation : ''}/${x.result.candidates.length}c/${x.result.total}t`).join(' '));

// docs/BENEFICIARY_EVAL.md, generated from the numbers above so README and file cannot drift
const n = (x) => Number(x).toLocaleString('en-US');
const cell = (r) => {
  if (!r.sentences) return 'no retirement sentence with a quantity';
  return r.results.map((x) => {
    const q = x.result.claimed != null ? `${n(x.result.claimed)} t` : 'no quantity';
    const res = x.result;
    if (!res.candidates.length) return `${q}: no candidate`;
    return `${q}: ${res.candidates.length} candidates, total ${n(res.total)} t, ${res.status === 'MATCH' ? 'equal' : res.relation === 'registry_lower' ? 'registry lower' : res.relation === 'registry_higher' ? 'registry higher' : res.status}`;
  }).join('; ');
};
const lines = [
  '# Sentence without a serial: does the Gold Standard registry give candidates? (measured ' + out.measured + ')',
  '',
  'Question (review): most real reports print no credit serial (0 of 10, [SERIAL_PREVALENCE.md](SERIAL_PREVALENCE.md)). Can the company, the year and the quantity in the sentence still be compared with a public record?',
  '',
  'Answer found in the registry\'s public read endpoint (`https://public-api.goldstandard.org/credits`, the same one the live lookup uses): every credit block carries `retirement_using_entity` (an object with the company `name`) and a free-text `note` (for example "Retired by Cool Effect on behalf of Google LLC"); the free-text `query` parameter searches them, and the response headers `X-Total-Count` and `X-Total-Number-Of-Credits` give the number of blocks and credits. Not every retired block names a beneficiary (privacy or marketplace orders), so a missing candidate is not proof of anything.',
  '',
  'Method: the same 10 public reports as the serial measurement. For each report the retirement sentences were copied verbatim into `data/reports/sentences.json` (regex pass for retire/offset near a quantity, then a manual read; the file was written before the matcher ran on it). The product code `checkBeneficiary` ran live on each sentence with the publisher as claimant; Gold Standard answers are cached in `data/reports/gs-beneficiary-cache.json`. Re-make: `node scripts/eval_beneficiary.mjs` (live) or `--offline` (from the cache).',
  '',
  'Sample status: these 10 reports are the sample we used for the serial question, so they are in-sample for that finding. For the beneficiary path they are first-time sentences: the matcher was written from the API fields and a fixture of three companies (Google, Apple, Storebrand), not from these sentences. One thing the first run did teach us: "605,354 metrics tons" (Microsoft) was not read as a quantity, so the unit was added with a test.',
  '',
  '| Report | Claimant | Sentences | Result of the registry lookup (sentence) | Company alone: retired blocks / credits on Gold Standard |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.publisher} | ${r.claimant} | ${r.sentences} | ${cell(r)} | ${r.company_probe.candidates ? `${r.company_probe.candidates} / ${n(r.company_probe.total)}` : 'none found'} |`),
  '',
  `**Result: ${out.with_sentence} of ${out.reports} reports contain a retirement sentence with a quantity; ${out.sentence_with_candidates} of ${out.reports} reports get at least one registry candidate for their sentence; ${out.sentence_quantity_equal} of ${out.reports} have a candidate total equal to the sentence.** Separately, ${out.company_has_gs_records} of ${out.reports} reports are from a company that has retired blocks under its own name on Gold Standard (Microsoft, Google, easyJet x2, Storebrand x2, Netflix); Commerzbank and AIXTRON have none, and Apple has none (a homonym, "Shenzhen Apple Brother Technology", is correctly not a candidate).`,
  '',
  'What this means:',
  '- With no serial the product can still say "the registry lists N blocks, X t retired for this company" and whether X equals the sentence. In these reports X was lower than the sentence every time it was found: a lower total is not a finding of over-claiming: the Apple report footnotes name VCS/CCB (Verra) projects and the Microsoft sentence is about removal credits, and this product looks up Gold Standard only.',
  '- It is a lead, not a verdict: the five serial verdicts are unchanged, and a sentence without a serial still returns No serial.',
  '- Sample is 10 reports chosen by us, 4 sentences, 3 reports with a sentence. Read it as what the path does on real text, not as a hit rate.',
];
fs.writeFileSync('docs/BENEFICIARY_EVAL.md', lines.join('\n') + '\n');
