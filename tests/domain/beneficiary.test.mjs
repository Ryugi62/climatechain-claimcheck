import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractBeneficiaryClaim, isCandidate, judgeBeneficiary } from '../../src/domain/beneficiary.mjs';
import { checkBeneficiary } from '../../src/application/checkBeneficiary.mjs';
import { checkClaim } from '../../src/application/checkClaim.mjs';
import { Ledger } from '../../src/domain/ledger.mjs';

const fx = JSON.parse(readFileSync(new URL('../fixtures/gs-beneficiary.json', import.meta.url), 'utf8'));
const google = fx.google, apple = fx.apple, store = fx.storebrand;
const S = 'In 2024 Google retired 131,201 tCO2e of Gold Standard credits.';

test('G15 two Google blocks add up to the sentence quantity: MATCH with 2 candidates', () => {
  const r = judgeBeneficiary({ claim: extractBeneficiaryClaim(S, 'Google'), records: google });
  assert.equal(r.status, 'MATCH');
  assert.equal(r.candidates.length, 2);
  assert.equal(r.total, 131201);
  assert.equal(r.claimed, 131201);
});

test('G16 sentence quantity above the registry total: MISMATCH registry_lower, both numbers shown', () => {
  const r = judgeBeneficiary({ claim: extractBeneficiaryClaim('In 2024 Google retired 500,000 tCO2e.', 'Google'), records: google });
  assert.equal(r.status, 'MISMATCH');
  assert.equal(r.relation, 'registry_lower');
  assert.equal(r.total, 131201);
  assert.equal(r.claimed, 500000);
});

test('G16 sentence quantity below the registry total: registry_higher', () => {
  const r = judgeBeneficiary({ claim: extractBeneficiaryClaim('In 2024 Google retired 100,000 tCO2e.', 'Google'), records: google });
  assert.equal(r.relation, 'registry_higher');
});

test('G17 a company that only contains the word is not a candidate', () => {
  const homonym = apple.find((r) => /Shenzhen Apple Brother/.test((r.retirement_using_entity || {}).name || ''));
  assert.ok(homonym, 'fixture holds the homonym');
  assert.equal(isCandidate(homonym, 'Apple'), false);
  const r = judgeBeneficiary({ claim: extractBeneficiaryClaim('We retired 70,000 metric tons of carbon credits.', 'Apple'), records: apple });
  assert.equal(r.status, 'NOT_FOUND');
});

test('G17 a note "for <person>" or a LEED note naming the company in the middle is not a candidate', () => {
  const leed = google.find((r) => /LEED/.test(r.note || ''));
  assert.equal(isCandidate(leed, 'Google'), false);
});

test('beneficiary is read from the note when the entity field is empty', () => {
  const rec = { status: 'RETIRED', number_of_credits: 1, note: 'Retired on behalf of Netflix', retirement_using_entity: null };
  assert.equal(isCandidate(rec, 'Netflix'), true);
  const rec2 = { status: 'RETIRED', number_of_credits: 1, note: 'Gold Standard Marketplace Order GSM28149 for easyjet europe' };
  assert.equal(isCandidate(rec2, 'easyJet'), true);
});

test('legal suffix and case are ignored, only RETIRED counts', () => {
  const base = { number_of_credits: 5, retirement_using_entity: { name: 'Storebrand Livsforsikring AS' } };
  assert.equal(isCandidate({ ...base, status: 'RETIRED' }, 'STOREBRAND'), true);
  assert.equal(isCandidate({ ...base, status: 'ISSUED' }, 'Storebrand'), false);
  assert.equal(isCandidate({ status: 'RETIRED', number_of_credits: 1, retirement_using_entity: { name: 'Google LLC' } }, 'Google Inc.'), true);
});

test('G18 no candidate: NOT_FOUND; no company name: NO_CLAIMANT', () => {
  const r = judgeBeneficiary({ claim: extractBeneficiaryClaim('We retired 10 tCO2e.', 'Commerzbank'), records: google });
  assert.equal(r.status, 'NOT_FOUND');
  const n = judgeBeneficiary({ claim: extractBeneficiaryClaim('We retired 10 tCO2e.', ''), records: google });
  assert.equal(n.status, 'NO_CLAIMANT');
});

test('the company can come from the sentence when the claimant field is empty', () => {
  assert.equal(extractBeneficiaryClaim('Storebrand retired 50 tCO2e in 2024.', '').claimant, 'Storebrand');
  assert.equal(extractBeneficiaryClaim('Credits were retired on behalf of Netflix, 12,207 t.', '').claimant, 'Netflix');
});

test('G19 year: records of the stated year are summed, otherwise all with year_scope all', () => {
  const y = judgeBeneficiary({ claim: extractBeneficiaryClaim('In 2024 Google retired 131,201 tCO2e.', 'Google'), records: google });
  assert.equal(y.yearScope, 'year');
  const none = judgeBeneficiary({ claim: extractBeneficiaryClaim('In 2019 Google retired 131,201 tCO2e.', 'Google'), records: google });
  assert.equal(none.yearScope, 'all');
  assert.equal(none.total, 131201);
  const fy = extractBeneficiaryClaim('In FY23 we retired 10 t.', 'X');
  assert.equal(fy.year, 2023);
});

test('no quantity in the sentence: candidates listed, status NO_QUANTITY', () => {
  const r = judgeBeneficiary({ claim: extractBeneficiaryClaim('Google retired credits in 2024.', 'Google'), records: google });
  assert.equal(r.status, 'NO_QUANTITY');
  assert.equal(r.candidates.length, 2);
});

test('use case asks the registry port by company name and judges', async () => {
  const asked = [];
  const registry = { findByEntity: async (name) => { asked.push(name); return store; } };
  const r = await checkBeneficiary({ text: 'In 2024 Storebrand retired 50 tCO2e.', claimant: 'Storebrand' }, { registry });
  assert.deepEqual(asked, ['Storebrand']);
  assert.equal(r.status, 'MATCH');
  assert.equal(r.candidates[0].serial_number, 'GS1-1-NI-GS4220-21-2018-22249-2020-2069');
});

test('a registry failure becomes an error result, not a crash', async () => {
  const registry = { findByEntity: async () => { throw new Error('registry answered HTTP 403'); } };
  const r = await checkBeneficiary({ text: 'Storebrand retired 50 t.', claimant: 'Storebrand' }, { registry });
  assert.equal(r.status, 'SOURCE_ERROR');
  assert.match(r.error, /403/);
});

test('G20 a sentence with a serial never uses the beneficiary path', async () => {
  let called = 0;
  const registry = { findByEntity: async () => { called++; return google; } };
  const r = await checkBeneficiary({ text: 'Google retired 5 t, serial GS1-1-MU-GS12147-21-2021-27149-1-5.', claimant: 'Google' }, { registry });
  assert.equal(r.status, 'HAS_SERIAL');
  assert.equal(called, 0);
});

test('G20 regression: the serial verdict for a sentence without serial stays NO_SERIAL', async () => {
  const r = await checkClaim({ text: S, claimant: 'Google' }, { records: { find: async () => null }, ledger: new Ledger() });
  assert.equal(r.verdict, 'NO_SERIAL');
});

test('live adapter pages through x-total-count and keeps source url and fetch time', async () => {
  const { goldStandardLive } = await import('../../src/adapters/goldStandardLive.mjs');
  const urls = [];
  const page = (n) => Array.from({ length: n }, (_, i) => ({ serial_number: `S${urls.length}-${i}`, status: 'RETIRED', number_of_credits: 1, project: { name: 'P' } }));
  const fetchImpl = async (url) => { urls.push(url); const body = urls.length === 1 ? page(20) : page(5); return { ok: true, headers: { get: () => '25' }, json: async () => body }; };
  const rows = await goldStandardLive(fetchImpl).findByEntity('Netflix Inc');
  assert.equal(rows.length, 25);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /query=Netflix%20Inc/);
  assert.ok(rows[0].source_url && rows[0].fetched_at && rows[0].project_name === 'P');
});

test('G19 a sentence that names a period (two different years) uses no year filter', () => {
  assert.equal(extractBeneficiaryClaim('We have offset 11,767,387 tonnes (19 November 2019-30 September 2022).', 'easyJet').year, null);
  assert.equal(extractBeneficiaryClaim('In 2024 we retired 5 t.', 'X').year, 2024);
});

test('a note that is only the company name counts (real records: "Netflix, Inc.")', () => {
  const rec = { status: 'RETIRED', number_of_credits: 4355, note: 'Netflix, Inc.' };
  assert.equal(isCandidate(rec, 'Netflix'), true);
  assert.equal(isCandidate({ ...rec, note: 'Netflix Streaming Services International, B.V.' }, 'Netflix'), true);
  assert.equal(isCandidate({ ...rec, note: 'Gold Standard Marketplace Order GSM24475 for Christof Appler' }, 'Apple'), false);
});

test('real report wording "605,354 metrics tons" is read as a quantity (found by the first run on real reports)', () => {
  assert.equal(extractBeneficiaryClaim('Additionally, we retired 605,354 metrics tons of carbon removal.', 'Microsoft').quantity, 605354);
});
