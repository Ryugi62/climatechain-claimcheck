// Second, wider sample (data/reports2): the product's beneficiary path on the retirement sentences found in 30 public reports.
// Live Gold Standard answers are cached in data/reports2/gs-cache.json (polite: 2 s between requests). --offline re-makes the table from the cache.
import fs from 'node:fs';
import { checkBeneficiary } from '../src/application/checkBeneficiary.mjs';
import { goldStandardLive } from '../src/adapters/goldStandardLive.mjs';

const CACHE = 'data/reports2/gs-cache.json';
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
const man = JSON.parse(fs.readFileSync('data/reports2/manifest.json', 'utf8'));
const spec = JSON.parse(fs.readFileSync('data/reports2/sentences.json', 'utf8'));
const rows = [];
for (const m of man) {
  const sents = spec.sentences.filter((s) => s.report === m.id);
  const company = await checkBeneficiary({ text: `${m.claimant} retired credits.`, claimant: m.claimant }, { registry });
  const results = [];
  for (const s of sents) results.push({ page: s.page, text: s.text, text_en: s.text_en || null, result: await checkBeneficiary({ text: s.text_en || s.text, claimant: m.claimant }, { registry }) });
  rows.push({ id: m.id, publisher: m.publisher, claimant: m.claimant, url: m.url, sentences: sents.length, company_probe: { status: company.status, candidates: company.candidates.length, total: company.total }, results });
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
fs.writeFileSync('data/reports2/results.json', JSON.stringify(out, null, 1) + '\n');
console.log(`reports ${out.reports} | with a retirement sentence ${out.with_sentence} | sentence + candidates ${out.sentence_with_candidates} | quantity equal ${out.sentence_quantity_equal} | company has GS retired records ${out.company_has_gs_records}`);
for (const r of rows) console.log(r.id.padEnd(24), 'probe', r.company_probe.status.padEnd(12), 'cand', String(r.company_probe.candidates).padStart(3), 'total', String(r.company_probe.total).padStart(8), '| sentences', r.sentences, r.results.map((x) => `${x.result.status}${x.result.relation ? ':' + x.result.relation : ''}/${x.result.candidates.length}c/${x.result.total}t/claimed ${x.result.claimed}`).join(' '));
