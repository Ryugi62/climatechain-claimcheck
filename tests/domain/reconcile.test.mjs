import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaim } from '../../src/domain/claim.mjs';
import { parseSerial } from '../../src/domain/serial.mjs';
import { Ledger } from '../../src/domain/ledger.mjs';
import { judge } from '../../src/domain/reconcile.mjs';

const GS = 'GS1-1-MZ-GS7643-16-2025-31135-1059-34189';
const rec = (o = {}) => ({ serial_number: GS, status: 'RETIRED', number_of_credits: 33131, registry: 'GOLD_STANDARD', source_url: 'u', fetched_at: 't', ...o });
const lookup = (records) => (s) => records.find(r => r.serial_number === s.raw) || null;

const run = (text, records, ledger = new Ledger(), claimant = 'A') =>
  judge({ claim: extractClaim(text), claimant, lookup: lookup(records), ledger });

test('G1 MATCH when retired and quantity equal', () => {
  const r = run(`We retired 33,131 tCO2e, ${GS}`, [rec()]);
  assert.equal(r.verdict, 'MATCH');
  assert.equal(r.lines[0].verdict, 'MATCH');
});

test('G1b MATCH without a stated quantity when retired', () => {
  assert.equal(run(`Serial ${GS} retired`, [rec()]).verdict, 'MATCH');
});

test('G2 MISMATCH not_retired when status is ISSUED', () => {
  const r = run(`We retired 33,131 tCO2e, ${GS}`, [rec({ status: 'ISSUED' })]);
  assert.equal(r.verdict, 'MISMATCH');
  assert.equal(r.lines[0].reason, 'not_retired');
});

test('G3 MISMATCH quantity_differs carries both numbers', () => {
  const r = run(`We retired 40,000 tCO2e, ${GS}`, [rec()]);
  assert.equal(r.verdict, 'MISMATCH');
  assert.equal(r.reason, 'quantity_differs');
  assert.equal(r.quantity.claimed, 40000);
  assert.equal(r.quantity.registry, 33131);
});

test('G4 NOT_FOUND when no record', () => {
  const r = run(`We retired 33,131 tCO2e, ${GS}`, []);
  assert.equal(r.verdict, 'NOT_FOUND');
});

test('G6 NO_SERIAL when sentence names no serial', () => {
  const r = run('We are fully offset.', [rec()]);
  assert.equal(r.verdict, 'NO_SERIAL');
  assert.deepEqual(r.lines, []);
});

test('G5 DUPLICATE when another claimant registered an overlapping range', () => {
  const ledger = new Ledger();
  ledger.register(parseSerial(GS), 'A');
  const r = run(`We retired 33,131 tCO2e, ${GS}`, [rec()], ledger, 'B');
  assert.equal(r.verdict, 'DUPLICATE');
  assert.equal(r.lines[0].overlap, 33131);
  assert.equal(r.lines[0].firstClaimant, 'A');
});

test('G5b same claimant checking its own claim again is not DUPLICATE', () => {
  const ledger = new Ledger();
  ledger.register(parseSerial(GS), 'A');
  assert.equal(run(`Retired ${GS}`, [rec()], ledger, 'A').verdict, 'MATCH');
});

test('G5c partial overlap reports the overlapping credit count', () => {
  const ledger = new Ledger();
  ledger.register(parseSerial('GS1-1-MZ-GS7643-16-2025-31135-1-1000'), 'A');
  const r = run('Retired GS1-1-MZ-GS7643-16-2025-31135-900-2000', [rec({ serial_number: 'GS1-1-MZ-GS7643-16-2025-31135-900-2000', number_of_credits: 1101 })], ledger, 'B');
  assert.equal(r.verdict, 'DUPLICATE');
  assert.equal(r.lines[0].overlap, 101);
});

test('G9 worst verdict wins over several serials, each line kept', () => {
  const other = 'GS1-1-MZ-GS7643-16-2025-31135-40000-40009';
  const r = run(`Retired ${GS} and ${other}`, [rec()]);
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].verdict, 'MATCH');
  assert.equal(r.lines[1].verdict, 'NOT_FOUND');
  assert.equal(r.verdict, 'NOT_FOUND');
});

test('quantity is compared with the sum over several serials', () => {
  const b = 'GS1-1-MZ-GS7643-16-2025-31135-40000-40009';
  const r = run(`We retired 33,141 tCO2e: ${GS} and ${b}`, [rec(), rec({ serial_number: b, number_of_credits: 10 })]);
  assert.equal(r.verdict, 'MATCH');
  assert.equal(r.quantity.registry, 33141);
});

test('G10 Verra serial is NOT_FOUND with registry_not_supported', () => {
  const v = '7456-198346632-198348830-VCU-044-MER-IN-14-1788-01012019-31122019-0';
  const r = run(`Retired ${v}`, []);
  assert.equal(r.verdict, 'NOT_FOUND');
  assert.equal(r.lines[0].reason, 'registry_not_supported');
});

test('record quantity that disagrees with the serial range is a MISMATCH', () => {
  const r = run(`Retired ${GS}`, [rec({ number_of_credits: 5 })]);
  assert.equal(r.verdict, 'MISMATCH');
  assert.equal(r.lines[0].reason, 'record_range_differs');
});

test('every result carries the evidence it used', () => {
  const r = run(`Retired ${GS}`, [rec()]);
  assert.equal(r.lines[0].evidence.source_url, 'u');
  assert.equal(r.lines[0].evidence.fetched_at, 't');
});

test('G32 overall MISMATCH by quantity: no line card shows Match, the line says the serial was found but the quantity differs', () => {
  const r = run(`We retired 36,445 tCO2e, ${GS}`, [rec()]);
  assert.equal(r.verdict, 'MISMATCH');
  assert.ok(r.lines.every((l) => l.verdict !== 'MATCH'));
  assert.equal(r.lines[0].reason, 'quantity_differs');
  assert.equal(r.lines[0].evidence.status, 'RETIRED');
});

test('G32b overall MATCH keeps its Match line (no change when the quantity agrees)', () => {
  const r = run(`We retired 33,131 tCO2e, ${GS}`, [rec()]);
  assert.equal(r.lines[0].verdict, 'MATCH');
});
