import test from 'node:test';
import assert from 'node:assert/strict';
import { checkClaim } from '../../src/application/checkClaim.mjs';
import { Ledger } from '../../src/domain/ledger.mjs';

const GS = 'GS1-1-MZ-GS7643-16-2025-31135-1059-34189';
const source = (records) => ({ find: async (s) => records.find(r => r.serial_number === s.raw) || null });
const rec = { serial_number: GS, status: 'RETIRED', number_of_credits: 33131, source_url: 'u', fetched_at: 't' };

test('use case reads the record source and judges', async () => {
  const r = await checkClaim({ text: `Retired 33,131 tCO2e ${GS}`, claimant: 'A' }, { records: source([rec]), ledger: new Ledger() });
  assert.equal(r.verdict, 'MATCH');
});

test('use case with commit registers the range so a second claimant is DUPLICATE', async () => {
  const ledger = new Ledger();
  const ports = { records: source([rec]), ledger };
  const a = await checkClaim({ text: `Retired ${GS}`, claimant: 'A', commit: true }, ports);
  const b = await checkClaim({ text: `Retired ${GS}`, claimant: 'B', commit: true }, ports);
  assert.equal(a.verdict, 'MATCH');
  assert.equal(b.verdict, 'DUPLICATE');
});

test('commit does not register a claim that is not a MATCH', async () => {
  const ledger = new Ledger();
  await checkClaim({ text: `Retired ${GS}`, claimant: 'A', commit: true }, { records: source([]), ledger });
  assert.equal(ledger.size(), 0);
});

test('a failing record source becomes an error result, not a crash', async () => {
  const bad = { find: async () => { throw new Error('network'); } };
  const r = await checkClaim({ text: `Retired ${GS}`, claimant: 'A' }, { records: bad, ledger: new Ledger() });
  assert.equal(r.verdict, 'NOT_FOUND');
  assert.equal(r.lines[0].reason, 'source_error');
});
