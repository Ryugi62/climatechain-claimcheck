// Measures the time of one live check (serial -> Gold Standard public endpoint -> verdict-ready record).
// 15 single requests on distinct real retired serials, 4 s apart. Writes docs/LIVE_LATENCY.json and prints the median.
import { readFileSync, writeFileSync } from 'node:fs';
import { goldStandardLive } from '../src/adapters/goldStandardLive.mjs';
import { parseSerial } from '../src/domain/serial.mjs';
const rows = JSON.parse(readFileSync(new URL('../data/gs/credits-sample.json', import.meta.url))).filter((r) => r.status === 'RETIRED');
const pick = rows.filter((_, i) => i % 7 === 3).slice(0, 15);
const live = goldStandardLive();
const ms = [];
const out = [];
for (const r of pick) {
  const t0 = performance.now();
  const got = await live.find(parseSerial(r.serial_number));
  const dt = Math.round(performance.now() - t0);
  ms.push(dt);
  out.push({ serial: r.serial_number, found: !!got, ms: dt });
  await new Promise((res) => setTimeout(res, 4000));
}
const s = [...ms].sort((a, b) => a - b);
const median = s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
const summary = { measured_at: new Date().toISOString().slice(0, 16) + 'Z', n: ms.length, found: out.filter((x) => x.found).length, median_ms: median, min_ms: s[0], max_ms: s[s.length - 1], where: 'Node fetch from the author machine (Korea), not the browser', rows: out };
writeFileSync(new URL('../docs/LIVE_LATENCY.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log(summary.n, summary.found, 'median ms', median, 'min', s[0], 'max', s[s.length - 1]);
