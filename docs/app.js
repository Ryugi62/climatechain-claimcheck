import { checkClaim } from './src/application/checkClaim.mjs';
import { Ledger } from './src/domain/ledger.mjs';
import { sampleRecords } from './src/adapters/sampleRecords.mjs';
import { goldStandardLive } from './src/adapters/goldStandardLive.mjs';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ledger = new Ledger();
let rows = [];

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
}
init().catch((e) => { $('result').textContent = 'Page failed to load: ' + e.message; });
