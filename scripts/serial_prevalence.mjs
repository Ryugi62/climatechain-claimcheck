// F11: how often does a real sustainability report print a credit serial?
// Input: data/reports/manifest.json (public PDF URLs) and extracted text in <dir>/<id>.txt
// (text layer, produced with PyMuPDF `page.get_text()`; PDFs are not stored in the repo).
// Uses the product's own findSerials. Output: data/reports/results.json
import fs from 'node:fs';
import path from 'node:path';
import { findSerials } from '../src/domain/serial.mjs';
const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/serial_prevalence.mjs <dir with id.txt files>'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync('data/reports/manifest.json', 'utf8'));
const rows = manifest.map((m) => {
  const raw = fs.readFileSync(path.join(dir, `${m.id}.txt`), 'utf8');
  const flat = raw.replace(/\s+/g, ' ');
  const serials = [...new Set([...findSerials(raw), ...findSerials(flat)].map((s) => s.raw))];
  const offsetWords = (flat.match(/\b(carbon (credit|offset)s?|offsets?|retired|retirement of)\b/gi) || []).length;
  const registry = (flat.match(/\b(Verra|Gold Standard|VCUs?|VCS)\b/g) || []).length;
  return { id: m.id, publisher: m.publisher, url: m.url, chars: raw.length, offsetWords, registryWords: registry, serialsFound: serials.length, serials };
});
const withSerial = rows.filter((r) => r.serialsFound > 0).length;
const out = { measured: new Date().toISOString().slice(0, 10), reports: rows.length, reportsWithSerial: withSerial, rows };
fs.writeFileSync('data/reports/results.json', JSON.stringify(out, null, 1) + '\n');
console.log(`${withSerial}/${rows.length} reports contain at least one serial`);
for (const r of rows) console.log(r.id.padEnd(20), 'serials', r.serialsFound, 'offset-words', r.offsetWords, 'registry-words', r.registryWords);
