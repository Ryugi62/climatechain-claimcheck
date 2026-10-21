// Measures the narrative check on the frozen pair set (SPEC S9-S12). Thresholds are NOT tuned here.
import { readFileSync, writeFileSync } from 'node:fs';
import { createTransformersNli } from '../src/adapters/transformersNli.mjs';
import { classifyReceipt, THRESHOLDS } from '../src/domain/narrative.mjs';
const d = JSON.parse(readFileSync('data/narrative/pairs.json', 'utf8'));
const nli = createTransformersNli({ load: () => import('@huggingface/transformers') });
let t0 = performance.now();
await nli.warm();
const loadMs = performance.now() - t0;
await nli.infer([{ premise: 'warm up', hypothesis: 'warm up' }]);
const res = [];
const times = [];
for (const p of d.pairs) {
  t0 = performance.now();
  const [inf] = await nli.infer([{ premise: p.premise, hypothesis: p.hypothesis }]);
  times.push(performance.now() - t0);
  res.push({ id: p.id, source: p.source, label: p.label, change: p.change, receipt: classifyReceipt(inf), ...Object.fromEntries(Object.entries(inf).map(([k, v]) => [k, +v.toFixed(4)])) });
}
const pct = (a, b) => (b ? +(100 * a / b).toFixed(1) : null);
const M = res.filter((r) => r.label === 'match'), C = res.filter((r) => r.label === 'changed');
const sub = (arr) => ({ n: arr.length, backed: arr.filter((r) => r.receipt === 'BACKED').length, may_conflict: arr.filter((r) => r.receipt === 'MAY_CONFLICT').length, no_receipt: arr.filter((r) => r.receipt === 'NO_RECEIPT').length });
const byKind = {};
for (const r of C) { (byKind[r.change] ??= []).push(r); }
const sorted = [...times].sort((a, b) => a - b);
const out = {
  thresholds: THRESHOLDS, model: 'Xenova/nli-deberta-v3-xsmall q8', runtime: `node ${process.version} onnxruntime-node`,
  pairs: res.length, match: sub(M), changed: sub(C),
  false_alarm_pct: pct(M.filter((r) => r.receipt === 'MAY_CONFLICT').length, M.length),
  backed_recall_pct: pct(M.filter((r) => r.receipt === 'BACKED').length, M.length),
  conflict_recall_on_changed_pct: pct(C.filter((r) => r.receipt === 'MAY_CONFLICT').length, C.length),
  backed_on_changed_pct: pct(C.filter((r) => r.receipt === 'BACKED').length, C.length),
  by_source: Object.fromEntries(['real_certificate', 'gold_standard_row'].map((s) => [s, { match: sub(M.filter((r) => r.source === s)), changed: sub(C.filter((r) => r.source === s)) }])),
  changed_by_kind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, sub(v)])),
  latency_ms: { model_load: Math.round(loadMs), per_sentence_median: Math.round(sorted[sorted.length >> 1]), per_sentence_p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]), per_sentence_max: Math.round(sorted.at(-1)) },
  rows: res,
};
writeFileSync('data/narrative/results-node.json', JSON.stringify(out, null, 1) + '\n');
const { rows, ...short } = out; console.log(JSON.stringify(short, null, 1));
