import { checkClaim } from './src/application/checkClaim.mjs';
import { Ledger } from './src/domain/ledger.mjs';
import { sampleRecords } from './src/adapters/sampleRecords.mjs';
import { goldStandardLive } from './src/adapters/goldStandardLive.mjs';
import { createTransformersNli } from './src/adapters/transformersNli.mjs';
import { checkNarrative } from './src/application/checkNarrative.mjs';
import { extractClaim } from './src/domain/claim.mjs';

// Feature flag (SPEC kill switch): false hides the whole narrative check; the verdict path does not depend on it.
const NARRATIVE = true;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ledger = new Ledger();
let rows = [];
let lastRecords = null;
const setStatus = (t) => { $('nstatus').textContent = t; };
const nli = createTransformersNli({
  load: async () => {
    const t = await import('./vendor/transformers.min.js');
    t.env.allowLocalModels = false;
    t.env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
    t.env.backends.onnx.wasm.numThreads = 1;
    return t;
  },
  device: 'wasm',
  onProgress: (p) => { if (p.status === 'progress' && p.file) setStatus('Downloading model: ' + Math.round(p.progress || 0) + '% (' + p.file.split('/').pop() + ')'); },
});
const RTAG = { BACKED: 'MATCH', MAY_CONFLICT: 'MISMATCH', NO_RECEIPT: 'NO_SERIAL' };
let modelReadyMs = null;
async function runNarrative() {
  const text = $('claim').value;
  const claim = extractClaim(text);
  const out = $('nresult');
  if (!lastRecords) await run();
  let record = null;
  for (const s of claim.serials) { try { record = await lastRecords.find(s); } catch { record = null; } if (record) break; }
  if (!record) { out.innerHTML = '<p><span class="tag NO_SERIAL">No receipt</span> There is no registry record to compare the wording with.</p>'; return; }
  try {
    $('nbtn').disabled = true;
    if (modelReadyMs === null) { setStatus('Loading the model (one-time download, about 90 MB, from huggingface.co)...'); const t0 = performance.now(); await nli.warm(); modelReadyMs = performance.now() - t0; }
    setStatus('Comparing...');
    const t1 = performance.now();
    const r = await checkNarrative({ text, record }, { nli });
    const ms = performance.now() - t1;
    if (r.error) throw new Error(r.error);
    const sub = r.inference ? `entails ${r.inference.entail.toFixed(2)} &middot; contradicts ${r.inference.contradict.toFixed(2)}` : 'too little wording to compare';
    out.innerHTML = `<p><span class="tag ${RTAG[r.receipt]}">${r.label}</span> <span class="sub small">${sub} &middot; ${Math.round(ms)} ms${modelReadyMs ? ` &middot; model load ${(modelReadyMs / 1000).toFixed(1)} s (first time only)` : ''}</span></p><p class="small sub">Wording compared: &ldquo;${esc(r.narrative)}&rdquo;<br>Record: ${esc(r.premise || '')}</p>`;
    window.__narrative = { receipt: r.receipt, ms, modelLoadMs: modelReadyMs };
    setStatus('');
  } catch (e) {
    setStatus('');
    out.innerHTML = '<p class="small">The wording check could not run: ' + esc(e.message) + '. The verdict above does not depend on it. Check your connection and try again.</p>';
  } finally { $('nbtn').disabled = false; }
}

const LABEL = { MATCH: 'Match', MISMATCH: 'Mismatch', NOT_FOUND: 'Not found', DUPLICATE: 'Double use', NO_SERIAL: 'No serial to check' };
const WHY = {
  retired: 'Public record says retired, quantity agrees.',
  not_retired: 'The credit exists but is not marked retired.',
  quantity_differs: 'Quantity in the sentence differs from the registry range.',
  record_range_differs: 'Registry record and serial range disagree.',
  not_in_records: 'Not in the records we hold (this does not prove it is fake).',
  registry_not_supported: 'Serial format recognised, but this registry has no free lookup here.',
  already_claimed: 'These credits were already used by another claim.',
  source_error: 'The registry could not be reached. Untick live lookup to use the stored sample.',
  no_serial: 'The sentence names no credit serial, so there is nothing to verify.',
};

function render(r) {
  const lines = r.lines.map((l) => `<div class="line"><span class="tag ${l.verdict}">${LABEL[l.verdict]}</span> <code>${esc(l.serial)}</code><br>${esc(WHY[l.reason] || l.reason)}${l.overlap ? ` Overlap: ${l.overlap.toLocaleString()} credits, first used by ${esc(l.firstClaimant)}.` : ''}${l.evidence ? `<br><span class="sub">registry status ${esc(l.evidence.status)}, ${Number(l.evidence.number_of_credits).toLocaleString()} credits &middot; source ${esc(l.evidence.source_url)} &middot; fetched ${esc(l.evidence.fetched_at)}</span>` : ''}</div>`).join('');
  const q = r.quantity.claimed != null ? `<p class="small">Claimed ${r.quantity.claimed.toLocaleString()} t &middot; registry ${r.quantity.registry == null ? 'n/a' : r.quantity.registry.toLocaleString()} t</p>` : '';
  $('result').innerHTML = `<div class="verdict ${r.verdict}">${LABEL[r.verdict]}</div><p>${esc(WHY[r.reason] || r.reason)}</p>${q}${lines}`;
}

async function run() {
  const records = $('live').checked ? goldStandardLive() : sampleRecords(rows);
  lastRecords = records;
  $('nresult').innerHTML = '';
  const r = await checkClaim({ text: $('claim').value, claimant: $('claimant').value.trim() || 'anonymous', commit: $('commit').checked }, { records, ledger });
  render(r);
}

async function init() {
  rows = await (await fetch('./data/credits-sample.json')).json();
  const res = await (await fetch('./data/results.json')).json();
  $('n-records').textContent = res.records.total;
  $('fetched').textContent = res.records.fetched_at[0].slice(0, 10);
  const ret = rows.filter((r) => r.status === 'RETIRED');
  const iss = rows.find((r) => r.status !== 'RETIRED');
  const a = ret[0], b = ret[3];
  const fmt = (n) => n.toLocaleString('en-US');
  const ex = {
    'Match': `In 2025 we retired ${fmt(a.number_of_credits)} tCO2e of Gold Standard credits (serial ${a.serial_number}).`,
    'Inflated': `In 2025 we retired ${fmt(Math.round(b.number_of_credits * 1.1) + 1)} tCO2e (serial ${b.serial_number}).`,
    'Not retired': `We retired ${fmt(iss.number_of_credits)} tCO2e, serial ${iss.serial_number}.`,
    'Unknown': `We retired 500 tCO2e, serial GS1-1-IN-GS5500-16-2025-39999-1-500.`,
    'No serial': 'We are carbon neutral thanks to high-quality offsets.',
  };
  $('claim').value = ex.Match;
  for (const [k, v] of Object.entries(ex)) {
    const bt = document.createElement('button'); bt.className = 'ghost'; bt.textContent = k;
    bt.onclick = () => { $('claim').value = v; run(); };
    $('examples').appendChild(bt);
  }
  $('go').onclick = run;
  if (NARRATIVE) {
    $('narr').hidden = false;
    $('nbtn').onclick = runNarrative;
    const ok = ret[0];
    const nm = (ok.project_name || '').replace(/^GS\d+\s+(?:VPA\s*\d+\s+)?/i, '');
    const ctry = new Intl.DisplayNames(['en'], { type: 'region' }).of(ok.country_code);
    const mk = (words) => `In ${ok.vintage} we retired ${fmt(ok.number_of_credits)} tCO2e ${words} (serial ${ok.serial_number}).`;
    for (const [k, v] of [['Wording backed', mk(`from ${nm} in ${ctry}`)], ['Wording changed', mk('from a landfill gas project in Turkey')]]) {
      const bt = document.createElement('button'); bt.className = 'ghost'; bt.textContent = k;
      bt.onclick = () => { $('claim').value = v; run().then(runNarrative); };
      $('nexamples').appendChild(bt);
    }
  }
  const tr = await (await fetch('./chain-transcript.json')).json();
  $('chain').innerHTML = `<table><tr><th>Step</th><th>Serial range</th><th>Result</th></tr>${tr.steps.map((s) => `<tr><td>${esc(s.label)}</td><td><code>${s.serialRange.join(' - ')}</code></td><td>${s.outcome === 'REGISTERED' ? `<span class="MATCH">Registered</span> (${s.gasUsed.toLocaleString()} gas)` : `<span class="DUPLICATE">Refused: ${esc(s.error)}</span> existing ${esc(s.args[1])}-${esc(s.args[2])}`}</td></tr>`).join('')}</table>`;
  const c = res.claims, d = res.double_use, e1 = res.extraction.set1_after_fixes, e2 = res.extraction.set2_heldout;
  const bk = c.by_kind;
  $('metrics').innerHTML = `<table>
  <tr><td>Real registry records</td><td>${res.records.total} (${res.records.retired} retired, ${res.records.issued} issued)</td></tr>
  <tr><td>Claims checked</td><td>${c.total}: Match ${c.verdict_totals.MATCH}, Mismatch ${c.verdict_totals.MISMATCH}, Not found ${c.verdict_totals.NOT_FOUND}, No serial ${c.verdict_totals.NO_SERIAL}</td></tr>
  <tr><td>Verdict as expected</td><td>${Math.round(c.accuracy * c.total)}/${c.total}</td></tr>
  <tr><td>Quantity inflated by 10%+1 caught</td><td>${bk.quantity_inflated.ok}/${bk.quantity_inflated.n}</td></tr>
  <tr><td>Issued-but-not-retired caught</td><td>${bk.issued_not_retired.ok}/${bk.issued_not_retired.n}</td></tr>
  <tr><td>Second claimant refused (double use)</td><td>${d.second_duplicate}/${d.pairs} full, ${d.partial_overlap_duplicate}/${d.partial_overlap_tried} partial</td></tr>
  <tr><td>Held-out phrasings: serial / quantity found</td><td>${e2.serial_recall} / ${e2.quantity_recall}</td></tr></table>`;
  try {
    const n = await (await fetch('./data/narrative.json')).json();
    $('metrics').innerHTML += `<p class="small"><b>Wording check</b> (${n.pairs} labelled pairs from real documents, thresholds frozen before the run): false alarms on matching wording ${n.false_alarm_pct}% (${n.match.may_conflict}/${n.match.n}), Backed on matching wording ${n.backed_recall_pct}%, May conflict on changed wording ${n.conflict_recall_on_changed_pct}% (it misses most changes, so No receipt is not a pass). Median ${n.latency_ms.per_sentence_median} ms per sentence after load.</p>`;
  } catch { /* no wording-check numbers bundled */ }
}
init().catch((e) => { $('result').textContent = 'Page failed to load: ' + e.message; });
