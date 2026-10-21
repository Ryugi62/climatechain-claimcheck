"""Runs the frozen pair set through the real page code (vendored transformers.js, wasm) in headless Chromium.
usage: python3 scripts/eval_narrative_browser.py <site-url> <out.json>   (needs `pip install playwright` + chromium)"""
import sys, json
from playwright.sync_api import sync_playwright
url, out = sys.argv[1].rstrip('/'), sys.argv[2]
JS = """async (base) => {
  const { createTransformersNli } = await import(base + '/src/adapters/transformersNli.mjs');
  const { classifyReceipt, THRESHOLDS } = await import(base + '/src/domain/narrative.mjs');
  const d = await (await fetch(base + '/data/narrative-pairs.json')).json();
  const t = await import(base + '/vendor/transformers.min.js');
  t.env.allowLocalModels = false; t.env.backends.onnx.wasm.wasmPaths = base + '/vendor/'; t.env.backends.onnx.wasm.numThreads = 1;
  const nli = createTransformersNli({ load: async () => t, device: 'wasm' });
  let t0 = performance.now(); await nli.warm(); const loadMs = performance.now() - t0;
  await nli.infer([{ premise: 'warm up', hypothesis: 'warm up' }]);
  const rows = [], times = [];
  for (const p of d.pairs) {
    t0 = performance.now(); const [inf] = await nli.infer([{ premise: p.premise, hypothesis: p.hypothesis }]); times.push(performance.now() - t0);
    rows.push({ id: p.id, source: p.source, label: p.label, change: p.change, receipt: classifyReceipt(inf), entail: +inf.entail.toFixed(4), contradict: +inf.contradict.toFixed(4), neutral: +inf.neutral.toFixed(4) });
  }
  return { rows, times, loadMs, thresholds: THRESHOLDS, ua: navigator.userAgent };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto(url + '/')
    r = pg.evaluate(JS, url); b.close()
rows, times = r['rows'], sorted(r['times'])
M = [x for x in rows if x['label'] == 'match']; C = [x for x in rows if x['label'] == 'changed']
pct = lambda a, n: round(100 * a / n, 1)
sub = lambda a: {'n': len(a), **{k: sum(x['receipt'] == k.upper() for x in a) for k in ('backed', 'may_conflict', 'no_receipt')}}
res = {'runtime': 'headless Chromium, vendored transformers.js, wasm, 1 thread: ' + r['ua'], 'model': 'Xenova/nli-deberta-v3-xsmall q8', 'thresholds': r['thresholds'], 'pairs': len(rows),
  'match': sub(M), 'changed': sub(C),
  'false_alarm_pct': pct(sum(x['receipt'] == 'MAY_CONFLICT' for x in M), len(M)), 'backed_recall_pct': pct(sum(x['receipt'] == 'BACKED' for x in M), len(M)),
  'conflict_recall_on_changed_pct': pct(sum(x['receipt'] == 'MAY_CONFLICT' for x in C), len(C)), 'backed_on_changed_pct': pct(sum(x['receipt'] == 'BACKED' for x in C), len(C)),
  'latency_ms': {'model_load': round(r['loadMs']), 'per_sentence_median': round(times[len(times) // 2]), 'per_sentence_p95': round(times[int(len(times) * .95)]), 'per_sentence_max': round(times[-1])},
  'changed_by_kind': {k: sub([x for x in C if x['change'] == k]) for k in sorted({x['change'] for x in C})},
  'by_source': {s: {'match': sub([x for x in M if x['source'] == s]), 'changed': sub([x for x in C if x['source'] == s])} for s in ('real_certificate', 'gold_standard_row')},
  'rows': rows}
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: v for k, v in res.items() if k != 'rows'}, indent=1))
