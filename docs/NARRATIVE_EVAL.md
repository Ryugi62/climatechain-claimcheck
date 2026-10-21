# Wording check: measured results (2026-10-21)

Pre-registered in SPEC.md (S9-S13) before any model run; thresholds frozen (entail >= 0.70, contradict >= 0.97), not tuned on this set. Pair set: `data/narrative/pairs.json`, 72 pairs = 36 matching + 36 with one fact changed. 48 pairs come from the 24 real retirement certificates (6 publishers), 24 from 12 Gold Standard registry rows. Narratives were written before the model was run. These numbers are from this task only.

Model: Xenova/nli-deberta-v3-xsmall (int8), inference only, no training.

| Pre-registered condition | Bar | Browser run (the shipped page code, headless Chromium, wasm) | Node run (onnxruntime-node) |
|---|---|---|---|
| Pairs | >= 30 | 72 | 72 |
| May conflict on matching wording (false alarm) | <= 10% | 2.8% (1/36) | 2.8% (1/36) |
| Backed on matching wording | >= 70% | 80.6% (29/36) | 80.6% (29/36) |
| One sentence after model load (median / p95) | <= 2000 ms | 95 / 175 ms | 10 / 17 ms |
| Model load (reported separately) | none | 6.3 s in this run; 90 s seen on a slower fetch | 6.7 s |

All four bars are met. The browser run is the official one because it executes the code the page ships.

## What it does not do well (not hidden)
- May conflict on changed wording: 27.8% (10/36) in the browser. Most changed facts end as No receipt, so No receipt means "not confirmed", never "fine".
- Backed on changed wording: 0.0% (0/36): it did not call any changed sentence Backed.
- Browser and node differ by a few probabilities (int8 numerics); thresholds were not re-tuned for either.
- Changed by kind (browser): company 1/2; country 1/8; project_type 3/12; quantity 1/2; registry 0/1; year 4/11 flagged as May conflict (few pairs for company, quantity, registry).
- The narrative check never changes a verdict (test G14).

Reproduce: `npm run eval:narrative` (node) and `python3 scripts/eval_narrative_browser.py <site url> data/narrative/results-browser.json`. Per-pair rows are in `data/narrative/results-*.json`.
