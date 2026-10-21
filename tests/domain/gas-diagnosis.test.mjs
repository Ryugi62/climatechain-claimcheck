import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const d = JSON.parse(read('docs/gas-diagnosis.json'));
const readme = read('README.md');
const cost = read('docs/COST.md');
const fmt = (n) => n.toLocaleString('en-US');

test('S16: same bytecode, same calldata, same number of new slots on both chains', () => {
  assert.equal(d.bytecodeEqualFull, true);
  assert.equal(d.local.sstoreCount, 6);
  assert.equal(d.sepolia.sstoreCount, 6);
  assert.equal(d.sepolia.slotsWrittenInRegistry, 6);
});

test('S16: the difference is the price of one new storage slot on the chain, not our code', () => {
  assert.ok(d.perNewSlotGas.sepoliaOverLocal > 4 && d.perNewSlotGas.sepoliaOverLocal < 6);
  assert.ok(Math.abs(d.perNewSlotGas.mainnetReadOnly - d.perNewSlotGas.local) < 500);
  assert.equal(d.sepoliaHeader.hasBlockAccessListHash, true);
  assert.equal(d.mainnetHeader.hasBlockAccessListHash, false);
});

test('S16: README states the measured cause and no longer says "did not investigate"', () => {
  assert.ok(!/did not investigate/i.test(readme));
  assert.ok(readme.includes(fmt(d.perNewSlotGas.sepolia)));
  assert.ok(readme.includes(fmt(d.perNewSlotGas.local)));
  assert.ok(readme.includes('docs/gas-diagnosis.json'));
});

test('S16: cost page says the 2-3 cent figure is priced at today\'s mainnet rule and may rise', () => {
  assert.ok(cost.includes('docs/gas-diagnosis.json'));
  assert.ok(/may rise|would rise|could rise/i.test(cost));
});
