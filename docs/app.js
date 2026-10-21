import { checkClaim } from './src/application/checkClaim.mjs';
import { Ledger } from './src/domain/ledger.mjs';
import { sampleRecords } from './src/adapters/sampleRecords.mjs';
import { goldStandardLive } from './src/adapters/goldStandardLive.mjs';
import { createTransformersNli } from './src/adapters/transformersNli.mjs';
import { checkNarrative } from './src/application/checkNarrative.mjs';
import { MATCH_LIMIT, wordingErrorTitle } from './src/domain/disclosure.mjs';
import { extractClaim } from './src/domain/claim.mjs';
import { checkBeneficiary } from './src/application/checkBeneficiary.mjs';
import { sepoliaRegistry } from './src/adapters/sepoliaRegistry.mjs';
import { claimHashOf } from './src/domain/chainAbi.mjs';

// Feature flag (SPEC kill switch): false hides the whole narrative check; the verdict path does not depend on it.
const NARRATIVE = true;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ledger = new Ledger();
let rows = [];
let lastRecords = null;
let realFlow = null; // docs/real-sentence-testnet.json: the real United Internet sentence registered on Sepolia
let flow = null; // docs/flow-testnet.json: the same credits on the Sepolia testnet
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com'; // free public endpoint, read calls only
const EXPLORER = 'https://eth-sepolia.blockscout.com/tx/';
const shortTx = (h) => `${h.slice(0, 10)}...${h.slice(-6)}`;
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

function chainNote(serial) {
  if (realFlow && realFlow.serial === serial) return `<br><span class="sub">On the Sepolia testnet this same serial range is registered: <a href="${EXPLORER}${realFlow.tx.hash}"><code>${shortTx(realFlow.tx.hash)}</code></a> (${realFlow.tx.gasUsed.toLocaleString()} gas).</span>`;
  if (!flow) return '';
  const reg = flow.registered.find((x) => x.serial === serial);
  if (!reg) return '';
  const s2 = flow.secondClaim;
  const second = s2.serial === serial ? ` A second claimant on the same range was refused: <a href="${EXPLORER}${s2.tx.hash}"><code>${shortTx(s2.tx.hash)}</code></a> reverted with <b>${esc(s2.revert)}</b>.` : '';
  return `<br><span class="sub">On the Sepolia testnet this same serial range is registered: <a href="${EXPLORER}${reg.tx.hash}"><code>${shortTx(reg.tx.hash)}</code></a> (${reg.tx.gasUsed.toLocaleString()} gas).${second}</span>`;
}

const BSTATUS = { MATCH: ['MATCH', 'Total equals the sentence'], MISMATCH: ['MISMATCH', 'Total differs from the sentence'], NOT_FOUND: ['NOT_FOUND', 'No candidate found'], NO_QUANTITY: ['NO_SERIAL', 'Candidates listed (no quantity in the sentence)'], NO_CLAIMANT: ['NO_SERIAL', 'No company name found'], SOURCE_ERROR: ['NOT_FOUND', 'The registry could not be reached'] };
function renderBeneficiary(b, claimant) {
  const out = $('bresult');
  const [cls, label] = BSTATUS[b.status] || ['NO_SERIAL', b.status];
  const rel = b.relation === 'registry_lower' ? ' The registry total is lower than the sentence.' : b.relation === 'registry_higher' ? ' The registry total is higher than the sentence.' : '';
  const scope = b.yearScope === 'year' ? ` Counted: records of ${b.year}.` : b.yearScope === 'all' && b.year ? ` No record of ${b.year}; all candidates counted.` : '';
  const head = b.candidates.length ? `<p class="small">${b.candidates.length} candidate${b.candidates.length > 1 ? 's' : ''} &middot; total ${Number(b.total).toLocaleString()} t &middot; sentence ${b.claimed == null ? 'n/a' : Number(b.claimed).toLocaleString()} t.${rel}${scope}</p>` : '';
  const rows = b.candidates.slice(0, 6).map((c) => `<div class="line"><code>${esc(c.serial_number)}</code><br>${Number(c.number_of_credits).toLocaleString()} credits &middot; vintage ${esc(c.vintage)} &middot; retired ${esc(c.retired_on || 'n/a')} &middot; beneficiary: ${esc(c.beneficiary || c.note || 'n/a')}<br><button class="ghost use" data-serial="${esc(c.serial_number)}" data-n="${c.number_of_credits}" data-v="${esc(c.retired_on || '')}">Check this serial</button>${chainNote(c.serial_number)}</div>`).join('');
  const more = b.candidates.length > 6 ? `<p class="small sub">${b.candidates.length - 6} more candidates not shown.</p>` : '';
  out.innerHTML = `<h3 style="font-size:16px;margin:16px 0 4px">No serial in the sentence: candidates for ${esc(claimant)} <span class="sub small">(registry lookup by beneficiary, not proof)</span></h3><div class="verdict ${cls}" style="font-size:24px">${label}</div>${b.status === 'MATCH' ? `<p class="small limit"><b>${MATCH_LIMIT}</b></p>` : ''}${head}${rows}${more}<p class="small sub">Candidates are Gold Standard records that name ${esc(claimant)} as the company the credits were retired for. A candidate total that equals the sentence is a lead, not an audit.</p>`;
  out.querySelectorAll('button.use').forEach((bt) => {
    bt.onclick = () => {
      $('claim').value = `In ${bt.dataset.v.slice(0, 4) || 'the year'} ${claimant} retired ${Number(bt.dataset.n).toLocaleString('en-US')} tCO2e (serial ${bt.dataset.serial}).`;
      run();
    };
  });
}
async function runBeneficiary() {
  const out = $('bresult');
  const text = $('claim').value;
  const c = $('claimant').value.trim();
  const given = /^company [a-z]$/i.test(c) || c.toLowerCase() === 'anonymous' ? '' : c;
  out.innerHTML = '<p class="small sub">No serial in the sentence. Looking up Gold Standard retirements by company name...</p>';
  const registry = goldStandardLive();
  const b = await checkBeneficiary({ text, claimant: given }, { registry });
  if (b.status === 'NO_CLAIMANT') { out.innerHTML = '<p class="small sub">There is no serial and no company name in the sentence. Write "Company X retired 500 t" or type the company in the box to look up candidates.</p>'; return; }
  renderBeneficiary(b, b.claimant);
  window.__beneficiary = b;
}

function render(r) {
  const lines = r.lines.map((l) => `<div class="line"><span class="tag ${l.verdict}">${LABEL[l.verdict]}</span> <code>${esc(l.serial)}</code><br>${esc(WHY[l.reason] || l.reason)}${l.source === 'chain' ? ` Answer read from the Sepolia contract <code>${esc(flow.contract.slice(0, 8))}...</code> just now: this range is already registered (claim hash <code>${esc(l.chainClaimHash.slice(0, 12))}...</code>, by ${esc(l.firstClaimant)}); overlap ${l.overlap.toLocaleString()} credits.` : l.overlap ? ` Overlap: ${l.overlap.toLocaleString()} credits, first used by ${esc(l.firstClaimant)} (this page's own memory, not the chain).` : ''}${l.evidence ? `${chainNote(l.serial)}<br><span class="sub">registry status ${esc(l.evidence.status)}, ${Number(l.evidence.number_of_credits).toLocaleString()} credits &middot; source ${esc(l.evidence.source_url)} &middot; fetched ${esc(l.evidence.fetched_at)}</span>` : ''}</div>`).join('');
  const q = r.quantity.claimed != null ? `<p class="small">Claimed ${r.quantity.claimed.toLocaleString()} t &middot; registry ${r.quantity.registry == null ? 'n/a' : r.quantity.registry.toLocaleString()} t</p>` : '';
  const lim = r.verdict === 'MATCH' ? `<p class="small limit"><b>${MATCH_LIMIT}</b></p>` : '';
  $('result').innerHTML = `<div class="verdict ${r.verdict}">${LABEL[r.verdict]}</div>${lim}<p>${esc(WHY[r.reason] || r.reason)}</p>${q}${lines}`;
}

async function run() {
  const records = $('live').checked ? goldStandardLive() : sampleRecords(rows);
  lastRecords = records;
  $('nresult').innerHTML = '';
  $('bresult').innerHTML = '';
  const chain = flow && $('chain').checked ? sepoliaRegistry({ rpcUrl: RPC, address: flow.contract }) : null;
  const knownClaims = [...(flow ? [{ claimant: flow.claimant, claimHash: claimHashOf(flow.claimant, flow.sentence) }] : []), ...(realFlow ? [{ claimant: realFlow.claimant, claimHash: claimHashOf(realFlow.claimant, realFlow.sentence) }] : [])];
  const r = await checkClaim({ text: $('claim').value, claimant: $('claimant').value.trim() || 'anonymous', commit: $('commit').checked }, { records, ledger, chain, knownClaims });
  render(r);
  window.__result = r;
  if (r.chainError) $('result').insertAdjacentHTML('beforeend', `<p class="small sub">The Sepolia registry could not be read (${esc(r.chainError)}). The verdict above is from the stored records and this page only; untick "read the Sepolia registry" to hide this note.</p>`);
  if (r.verdict === 'NO_SERIAL' && $('live').checked) await runBeneficiary();
  else if (r.verdict === 'NO_SERIAL') $('bresult').innerHTML = '<p class="small sub">Tick "live lookup" to look for candidates by company name in the Gold Standard registry.</p>';
}

async function init() {
  try { flow = await (await fetch('./flow-testnet.json')).json(); } catch { flow = null; }
  try { realFlow = await (await fetch('./real-sentence-testnet.json')).json(); } catch { realFlow = null; }
  rows = await (await fetch('./data/credits-sample.json')).json();
  const res = await (await fetch('./data/results.json')).json();
  $('n-records').textContent = res.records.total;
  $('fetched').textContent = res.records.fetched_at[0].slice(0, 10);
  const ret = rows.filter((r) => r.status === 'RETIRED');
  const iss = rows.find((r) => r.status !== 'RETIRED');
  const a = ret[0];
  const fmt = (n) => n.toLocaleString('en-US');
  const ex = {
    'Match': `In 2025 we retired ${fmt(a.number_of_credits)} tCO2e of Gold Standard credits (serial ${a.serial_number}).`,
    'Inflated': `In 2025 we retired ${fmt(Math.round(a.number_of_credits * 1.1) + 1)} tCO2e (serial ${a.serial_number}).`,
    'Not retired': `We retired ${fmt(iss.number_of_credits)} tCO2e, serial ${iss.serial_number}.`,
    'Unknown': `We retired 500 tCO2e, serial GS1-1-IN-GS5500-16-2025-39999-1-500.`,
    'No serial': 'We are carbon neutral thanks to high-quality offsets.',
    'No serial, company': 'In 2024 Google retired 131,201 tCO2e of Gold Standard credits through Cool Effect.',
  };
  if (realFlow) ex['Real report sentence'] = realFlow.sentence;
  $('claim').value = ex.Match;
  for (const [k, v] of Object.entries(ex)) {
    const bt = document.createElement('button'); bt.className = 'ghost'; bt.textContent = k;
    bt.onclick = () => {
      $('claim').value = v; $('realnote').innerHTML = '';
      if (k === 'No serial, company') { $('live').checked = true; $('claimant').value = 'Google'; }
      if (k === 'Real report sentence') { $('live').checked = true; $('claimant').value = realFlow.claimant; $('realnote').innerHTML = `<p class="small sub">This sentence was written by the company: United Internet, Sustainability Report 2024 (<a href="${esc(realFlow.source)}">source page</a>). It names the segment, not the legal entity; United Internet's Business Access segment is the business of 1&amp;1 Versatel, so the company box says ${esc(realFlow.claimant)}.</p>`; }
      run();
    };
    $('examples').appendChild(bt);
  }
  $('go').onclick = run;
  if (NARRATIVE) {
    $('narr').hidden = false;
    $('nbtn').onclick = runNarrative;
    fetch('./data/narrative.json').then((x) => x.json()).then((n) => { $('ntitle').textContent = wordingErrorTitle(n); }).catch(() => {});
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
  try {
    if (!flow) throw new Error('no flow');
    const rows2 = [...flow.registered.map((x, i) => `<tr><td>Registered on Sepolia (candidate ${i + 1})</td><td><code>${esc(x.serial)}</code></td><td><span class="MATCH">Registered</span> <a href="${EXPLORER}${x.tx.hash}"><code>${shortTx(x.tx.hash)}</code></a> (${x.tx.gasUsed.toLocaleString()} gas)</td></tr>`),
      `<tr><td>Second claimant, same range</td><td><code>${esc(flow.secondClaim.serial)}</code></td><td><span class="DUPLICATE">Refused: ${esc(flow.secondClaim.revert)}</span> <a href="${EXPLORER}${flow.secondClaim.tx.hash}"><code>${shortTx(flow.secondClaim.tx.hash)}</code></a></td></tr>`].join('');
    $('flow').innerHTML = `<p class="small">Sentence: &ldquo;${esc(flow.sentence)}&rdquo;<br><span class="sub">${esc(flow.note)} Gold Standard lookup by beneficiary: ${flow.check.candidates.length} candidates, total ${flow.check.total.toLocaleString()} t, equals the sentence.</span></p><table><tr><th>Step</th><th>Serial</th><th>Result on chain</th></tr>${rows2}</table>`;
  } catch { $('flow').textContent = ''; }
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
