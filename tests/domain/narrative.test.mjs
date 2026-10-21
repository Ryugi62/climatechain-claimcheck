import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordText, narrativeOf, classifyReceipt, THRESHOLDS } from '../../src/domain/narrative.mjs';
import { checkNarrative } from '../../src/application/checkNarrative.mjs';
import { checkClaim } from '../../src/application/checkClaim.mjs';
import { Ledger } from '../../src/domain/ledger.mjs';
import { sampleRecords } from '../../src/adapters/sampleRecords.mjs';

const GS = 'GS1-1-MZ-GS7643-16-2025-31135-1059-34189';
const rec = { serial_number: GS, status: 'RETIRED', number_of_credits: 33131, vintage: '2025', country_code: 'MZ', project_name: 'GS7591 VPA 23 Central Mozambique Safe Water Programme', registry: 'GOLD_STANDARD' };

test('recordText states project, country name, vintage, quantity and status in plain sentences', () => {
  const t = recordText(rec);
  assert.match(t, /Central Mozambique Safe Water Programme/);
  assert.match(t, /Mozambique/);
  assert.match(t, /2025/);
  assert.match(t, /33,131/);
  assert.match(t, /retired/i);
  assert.doesNotMatch(t, /GS1-1-MZ/);
});

test('recordText says issued, not retired, for an ISSUED record', () => {
  assert.match(recordText({ ...rec, status: 'ISSUED' }), /issued/i);
  assert.doesNotMatch(recordText({ ...rec, status: 'ISSUED' }), /were retired|is retired/i);
});

test('narrativeOf removes serials and keeps the wording', () => {
  const n = narrativeOf(`In 2025 we retired 33,131 tCO2e (serial ${GS}) from a water project.`);
  assert.doesNotMatch(n, /GS1-1/);
  assert.match(n, /water project/);
  assert.doesNotMatch(n, /\(\s*serial\s*\)/i);
});

test('narrativeOf of an empty or serial-only text is empty', () => {
  assert.equal(narrativeOf(''), '');
  assert.equal(narrativeOf(GS), '');
});

test('classifyReceipt uses frozen thresholds: entail>=0.70 BACKED, contradict>=0.97 MAY_CONFLICT, else NO_RECEIPT', () => {
  assert.deepEqual([THRESHOLDS.entail, THRESHOLDS.contradict], [0.7, 0.97]);
  assert.equal(classifyReceipt({ entail: 0.7, contradict: 0.1, neutral: 0.2 }), 'BACKED');
  assert.equal(classifyReceipt({ entail: 0.69, contradict: 0.1, neutral: 0.21 }), 'NO_RECEIPT');
  assert.equal(classifyReceipt({ entail: 0.01, contradict: 0.97, neutral: 0.02 }), 'MAY_CONFLICT');
  assert.equal(classifyReceipt({ entail: 0.01, contradict: 0.96, neutral: 0.03 }), 'NO_RECEIPT');
});

const fakeNli = (inf) => ({ calls: [], async infer(pairs) { this.calls.push(...pairs); return pairs.map(() => inf); } });

test('G11 checkNarrative: record found and entailed -> BACKED, premise is the record text', async () => {
  const nli = fakeNli({ entail: 0.9, contradict: 0.05, neutral: 0.05 });
  const r = await checkNarrative({ text: `We retired 33,131 credits for a water programme in Mozambique, ${GS}.`, record: rec }, { nli });
  assert.equal(r.receipt, 'BACKED');
  assert.equal(nli.calls.length, 1);
  assert.equal(nli.calls[0].premise, recordText(rec));
  assert.doesNotMatch(nli.calls[0].hypothesis, /GS1-1/);
});

test('G12 checkNarrative: contradiction -> MAY_CONFLICT with the wording "may"', async () => {
  const nli = fakeNli({ entail: 0, contradict: 0.99, neutral: 0.01 });
  const r = await checkNarrative({ text: 'We retired credits from a wind farm in Norway.', record: rec }, { nli });
  assert.equal(r.receipt, 'MAY_CONFLICT');
  assert.match(r.label, /may conflict/i);
});

test('G13 checkNarrative: no record or empty narrative -> NO_RECEIPT without calling the model', async () => {
  const nli = fakeNli({ entail: 1, contradict: 0, neutral: 0 });
  assert.equal((await checkNarrative({ text: 'We offset everything.', record: null }, { nli })).receipt, 'NO_RECEIPT');
  assert.equal((await checkNarrative({ text: GS, record: rec }, { nli })).receipt, 'NO_RECEIPT');
  assert.equal(nli.calls.length, 0);
});

test('G13b checkNarrative: model failure is reported, not thrown, and is NO_RECEIPT', async () => {
  const nli = { async infer() { throw new Error('offline'); } };
  const r = await checkNarrative({ text: 'We retired credits from a water project.', record: rec }, { nli });
  assert.equal(r.receipt, 'NO_RECEIPT');
  assert.equal(r.error, 'offline');
});

test('G14 isolation: checkClaim result is identical whether or not the narrative module is used', async () => {
  const rows = JSON.parse(readFileSync(new URL('../../data/gs/credits-sample.json', import.meta.url)));
  const text = `We retired ${rows[0].number_of_credits} tCO2e (serial ${rows[0].serial_number}) from a wind farm.`;
  const run = () => checkClaim({ text, claimant: 'A' }, { records: sampleRecords(rows), ledger: new Ledger() });
  const a = await run();
  await checkNarrative({ text, record: rows[0] }, { nli: fakeNli({ entail: 0, contradict: 1, neutral: 0 }) });
  const b = await run();
  assert.deepEqual(a, b);
});

test('S9 pair set is frozen: >=30 pairs, both labels, kinds, premise has no serial', () => {
  const d = JSON.parse(readFileSync(new URL('../../data/narrative/pairs.json', import.meta.url)));
  assert.ok(d.pairs.length >= 30);
  const m = d.pairs.filter((p) => p.label === 'match').length, c = d.pairs.filter((p) => p.label === 'changed').length;
  assert.ok(m >= 15 && c >= 15 && m === c);
  assert.ok(d.pairs.every((p) => p.premise && p.hypothesis && !/GS1-1-[A-Z]{2}-/.test(p.premise)));
  assert.ok(d.pairs.filter((p) => p.source === 'real_certificate').length >= 48);
});

import { createTransformersNli, toInference } from '../../src/adapters/transformersNli.mjs';

test('adapter toInference maps logits by the model id2label (order differs between models)', () => {
  const p = toInference([0, 5, 0], { 0: 'contradiction', 1: 'entailment', 2: 'neutral' });
  assert.ok(p.entail > 0.98 && p.contradict < 0.01);
  const q = toInference([5, 0, 0], { 0: 'CONTRADICTION', 1: 'ENTAILMENT', 2: 'NEUTRAL' });
  assert.ok(q.contradict > 0.98 && q.entail < 0.01);
});

test('adapter loads the library lazily, once, and batches pairs into one forward pass', async () => {
  let loads = 0, forwards = 0;
  const lib = {
    AutoTokenizer: { from_pretrained: async () => async (a, o) => ({ a, o }) },
    AutoModelForSequenceClassification: { from_pretrained: async () => Object.assign(async () => { forwards++; return { logits: { dims: [2, 3], data: Float32Array.from([0, 5, 0, 5, 0, 0]) } }; }, { config: { id2label: { 0: 'contradiction', 1: 'entailment', 2: 'neutral' } } }) },
  };
  const nli = createTransformersNli({ load: async () => { loads++; return lib; } });
  assert.equal(loads, 0);
  const out = await nli.infer([{ premise: 'a', hypothesis: 'b' }, { premise: 'c', hypothesis: 'd' }]);
  await nli.infer([{ premise: 'a', hypothesis: 'b' }]).catch(() => {});
  assert.equal(loads, 1);
  assert.equal(forwards >= 1, true);
  assert.ok(out[0].entail > 0.98 && out[1].contradict > 0.98);
});
