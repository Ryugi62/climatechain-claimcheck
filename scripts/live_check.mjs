// 11 single requests, 4 s apart: does the live read endpoint agree with the stored sample?
import { readFileSync, writeFileSync } from 'node:fs';
import { goldStandardLive } from '../src/adapters/goldStandardLive.mjs';
import { parseSerial } from '../src/domain/serial.mjs';
const rows = JSON.parse(readFileSync(new URL('../data/gs/credits-sample.json', import.meta.url)));
const pick = [...rows.filter((r) => r.status === 'RETIRED').filter((_, i) => i % 24 === 0).slice(0, 5), ...rows.filter((r) => r.status !== 'RETIRED').slice(0, 3)];
const fake = rows.filter((r) => r.status === 'RETIRED').slice(0, 3).map((r) => { const p = r.serial_number.split('-'); p[6] = String(Number(p[6]) + 900000); return { serial_number: p.join('-'), status: 'ABSENT' }; });
const live = goldStandardLive();
const out = [];
for (const r of [...pick, ...fake]) {
  const got = await live.find(parseSerial(r.serial_number));
  out.push({ serial: r.serial_number, sample_status: r.status, live_status: got ? got.status : null, agree: (got ? got.status : 'ABSENT') === r.status });
  await new Promise((res) => setTimeout(res, 4000));
}
const summary = { checked_at: new Date().toISOString().slice(0, 16) + 'Z', n: out.length, agree: out.filter((x) => x.agree).length, rows: out };
writeFileSync(new URL('../data/eval/live-check.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log(summary.n, summary.agree);
