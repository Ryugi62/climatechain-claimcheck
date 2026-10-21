import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import { keccak256Utf8 } from '../../src/domain/keccak.mjs';
import { batchKeyHash, encodeConflictsWith, encodeRangeCount, encodeRangeAt, decodeBool, decodeUint, decodeRange, claimHashOf } from '../../src/domain/chainAbi.mjs';
import { checkClaim } from '../../src/application/checkClaim.mjs';
import { Ledger } from '../../src/domain/ledger.mjs';

const GS = 'GS1-1-MU-GS12147-21-2022-27150-1257-62800';
const KEY = 'GOLD_STANDARD:GS12147:2022:27150';
const rec = { serial_number: GS, status: 'RETIRED', number_of_credits: 61544, source_url: 'u', fetched_at: 't' };
const records = { find: async (s) => (s.raw === GS ? rec : null) };
const SENT = `In 2022 we retired 61,544 tCO2e (serial ${GS}).`;
const regRow = (claimHash) => ({ start: 1257, end: 62800, claimHash, attestor: '0x992709971ba320c78a84581b14f4fe16d1c29d23' });

test('G26 keccak256 equals ethers for empty, short, long and batch-key strings', () => {
  for (const s of ['', 'abc', KEY, 'x'.repeat(135), 'x'.repeat(136), 'x'.repeat(137), 'claim:Google:' + SENT]) {
    assert.equal(keccak256Utf8(s), ethers.id(s), JSON.stringify(s).slice(0, 30));
  }
});

test('G26 calldata equals ethers Interface encoding', () => {
  const i = new ethers.Interface(['function conflictsWith(bytes32,uint64,uint64) view returns (bool)', 'function rangeCount(bytes32) view returns (uint256)', 'function rangeAt(bytes32,uint256) view returns (tuple(uint64 start,uint64 end,bytes32 claimHash,bytes32 evidenceHash,address attestor))']);
  const k = batchKeyHash(KEY);
  assert.equal(k, ethers.id(KEY));
  assert.equal(encodeConflictsWith(KEY, 1257, 62800), i.encodeFunctionData('conflictsWith', [k, 1257n, 62800n]));
  assert.equal(encodeRangeCount(KEY), i.encodeFunctionData('rangeCount', [k]));
  assert.equal(encodeRangeAt(KEY, 3), i.encodeFunctionData('rangeAt', [k, 3n]));
});

test('G26 return data decoding equals ethers', () => {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  assert.equal(decodeBool(coder.encode(['bool'], [true])), true);
  assert.equal(decodeBool(coder.encode(['bool'], [false])), false);
  assert.equal(decodeUint(coder.encode(['uint256'], [7n])), 7);
  const h = ethers.id('c'); const e = ethers.id('e');
  const data = coder.encode(['uint64', 'uint64', 'bytes32', 'bytes32', 'address'], [1257n, 62800n, h, e, '0x992709971ba320c78a84581b14f4fe16d1c29d23']);
  assert.deepEqual(decodeRange(data), { start: 1257, end: 62800, claimHash: h, evidenceHash: e, attestor: '0x992709971ba320c78a84581b14f4fe16d1c29d23' });
});

test('claimHashOf follows the scripts: keccak of "claim:<claimant>:<sentence>"', () => {
  assert.equal(claimHashOf('Google', SENT), ethers.id(`claim:Google:${SENT}`));
});

test('G22 another claimant on a range registered on chain gets DUPLICATE with source chain', async () => {
  const chain = { overlaps: async () => [regRow(ethers.id('claim:Google:other sentence'))] };
  const r = await checkClaim({ text: SENT, claimant: 'Company B' }, { records, ledger: new Ledger(), chain, knownClaims: [{ claimant: 'Google', claimHash: ethers.id('claim:Google:other sentence') }] });
  assert.equal(r.verdict, 'DUPLICATE');
  assert.equal(r.lines[0].source, 'chain');
  assert.equal(r.lines[0].firstClaimant, 'Google');
  assert.equal(r.lines[0].overlap, 61544);
  assert.equal(r.lines[0].chainClaimHash, ethers.id('claim:Google:other sentence'));
});

test('G22 an unknown claim hash is still DUPLICATE for a claimant who cannot show it is theirs', async () => {
  const chain = { overlaps: async () => [regRow(ethers.id('claim:somebody:else'))] };
  const r = await checkClaim({ text: SENT, claimant: 'Company B' }, { records, ledger: new Ledger(), chain });
  assert.equal(r.verdict, 'DUPLICATE');
  assert.match(r.lines[0].firstClaimant, /^an earlier claim 0x[0-9a-f]{8}/);
});

test('G23 the claimant whose known claim registered the range is not a duplicate', async () => {
  const h = ethers.id('claim:Google:other sentence');
  const chain = { overlaps: async () => [regRow(h)] };
  const r = await checkClaim({ text: SENT, claimant: 'google' }, { records, ledger: new Ledger(), chain, knownClaims: [{ claimant: 'Google', claimHash: h }] });
  assert.equal(r.verdict, 'MATCH');
});

test('G23 the hash of this very sentence by this claimant is the claimant\'s own claim', async () => {
  const chain = { overlaps: async () => [regRow(claimHashOf('Company A', SENT))] };
  const r = await checkClaim({ text: SENT, claimant: 'Company A' }, { records, ledger: new Ledger(), chain });
  assert.equal(r.verdict, 'MATCH');
});

test('G24 an unreachable chain leaves the verdict as without chain and reports chainError', async () => {
  const chain = { overlaps: async () => { throw new Error('rpc down'); } };
  const r = await checkClaim({ text: SENT, claimant: 'Company B' }, { records, ledger: new Ledger(), chain });
  assert.equal(r.verdict, 'MATCH');
  assert.match(r.chainError, /rpc down/);
});

test('G24 the chain never rescues a NOT_FOUND into anything but its own DUPLICATE rule', async () => {
  const chain = { overlaps: async () => [] };
  const r = await checkClaim({ text: SENT, claimant: 'B' }, { records: { find: async () => null }, ledger: new Ledger(), chain });
  assert.equal(r.verdict, 'NOT_FOUND');
});

test('G25 without a chain port the page ledger still answers double use', async () => {
  const ledger = new Ledger();
  await checkClaim({ text: SENT, claimant: 'A', commit: true }, { records, ledger });
  const b = await checkClaim({ text: SENT, claimant: 'B' }, { records, ledger });
  assert.equal(b.verdict, 'DUPLICATE');
  assert.notEqual(b.lines[0].source, 'chain');
});

test('G22 when the page ledger and the chain both know the range, the chain is named as the source', async () => {
  const h = ethers.id('claim:Google:s');
  const chain = { overlaps: async () => [regRow(h)] };
  const ledger = new Ledger();
  await checkClaim({ text: SENT, claimant: 'Google', commit: true }, { records, ledger });
  const r = await checkClaim({ text: SENT, claimant: 'Company B' }, { records, ledger, chain, knownClaims: [{ claimant: 'Google', claimHash: h }] });
  assert.equal(r.lines[0].source, 'chain');
  assert.equal(r.lines[0].firstClaimant, 'Google');
});

test('S17 the recorded real Sepolia read shows Company B DUPLICATE from the chain and Google not duplicate', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../../docs/chain-read-sepolia.json', import.meta.url), 'utf8'));
  assert.equal(d.claims['Company B'].verdict, 'DUPLICATE');
  assert.equal(d.claims['Company B'].source, 'chain');
  assert.equal(d.claims['Company B'].overlap, 61544);
  assert.equal(d.claims['Google'].verdict, 'MATCH');
  assert.equal(d.real.claims['Company B'].verdict, 'DUPLICATE');
  assert.equal(d.real.claims['Company B'].source, 'chain');
  assert.equal(d.real.claims['Company B'].firstClaimant, '1&1 Versatel');
  assert.equal(d.real.claims['Company B'].overlap, 4713);
  assert.equal(d.real.claims['1&1 Versatel'].verdict, 'MATCH');
});
