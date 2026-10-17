import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../../src/domain/ledger.mjs';
import { parseSerial } from '../../src/domain/serial.mjs';

const R = (a, b, batch = 31135) => parseSerial(`GS1-1-MZ-GS7643-16-2025-${batch}-${a}-${b}`);

test('empty ledger has no conflicts', () => {
  assert.deepEqual(new Ledger().conflicts(R(1, 10), 'A'), []);
});

test('exact repeat by another claimant conflicts', () => {
  const l = new Ledger(); l.register(R(1, 10), 'A');
  const c = l.conflicts(R(1, 10), 'B');
  assert.equal(c.length, 1);
  assert.equal(c[0].overlap, 10);
});

test('adjacent ranges do not conflict', () => {
  const l = new Ledger(); l.register(R(1, 10), 'A');
  assert.deepEqual(l.conflicts(R(11, 20), 'B'), []);
});

test('same numbers in another batch do not conflict', () => {
  const l = new Ledger(); l.register(R(1, 10), 'A');
  assert.deepEqual(l.conflicts(R(1, 10, 99999), 'B'), []);
});

test('register refuses a conflicting range and keeps the ledger unchanged', () => {
  const l = new Ledger(); l.register(R(1, 10), 'A');
  const res = l.register(R(5, 15), 'B');
  assert.equal(res.ok, false);
  assert.equal(l.size(), 1);
});

test('register accepts a clean range', () => {
  const l = new Ledger();
  assert.equal(l.register(R(1, 10), 'A').ok, true);
  assert.equal(l.register(R(11, 20), 'B').ok, true);
  assert.equal(l.size(), 2);
});

test('contained and containing ranges conflict', () => {
  const l = new Ledger(); l.register(R(100, 200), 'A');
  assert.equal(l.conflicts(R(120, 130), 'B')[0].overlap, 11);
  assert.equal(l.conflicts(R(50, 300), 'B')[0].overlap, 101);
});
