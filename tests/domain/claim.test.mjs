import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClaim } from '../../src/domain/claim.mjs';

const GS = 'GS1-1-MZ-GS7643-16-2025-31135-1059-34189';

test('extracts serial and quantity with thousands separator', () => {
  const c = extractClaim(`We retired 33,131 tCO2e (serial ${GS}) in 2025.`);
  assert.equal(c.serials.length, 1);
  assert.equal(c.quantity, 33131);
});

test('does not read digits inside the serial as the quantity', () => {
  const c = extractClaim(`Serial ${GS} was retired.`);
  assert.equal(c.quantity, null);
});

test('reads tonnes wording', () => {
  assert.equal(extractClaim('Offset 12000 tonnes of CO2 via GS1-1-MZ-GS7643-16-2025-31135-1-12000').quantity, 12000);
});

test('reads tCO2 with subscript two', () => {
  assert.equal(extractClaim('We cancelled 500 tCO₂e, GS1-1-MZ-GS7643-16-2025-31135-1-500').quantity, 500);
});

test('reads kilotonnes and megatonnes', () => {
  assert.equal(extractClaim('Retired 2.5 ktCO2e').quantity, 2500);
  assert.equal(extractClaim('Retired 1.2 MtCO2e').quantity, 1200000);
});

test('reads "million tonnes"', () => {
  assert.equal(extractClaim('We offset 1.5 million tonnes of CO2e').quantity, 1500000);
});

test('reads credits / VCUs as quantity', () => {
  assert.equal(extractClaim('Retirement of 2,199 VCUs').quantity, 2199);
  assert.equal(extractClaim('We retired 800 carbon credits').quantity, 800);
});

test('takes the first quantity that has a unit', () => {
  assert.equal(extractClaim('In 2024 we retired 700 tCO2e and in 2025 900 tCO2e').quantity, 700);
});

test('ignores years and plain numbers without a unit', () => {
  assert.equal(extractClaim('In 2025 we did 3 projects').quantity, null);
});

test('empty and non-string input give an empty claim', () => {
  assert.deepEqual(extractClaim(''), { serials: [], quantity: null, text: '' });
  assert.deepEqual(extractClaim(undefined), { serials: [], quantity: null, text: '' });
});

test('reads space-separated thousands (4 000 tCO2e) and never returns the trailing group alone', () => {
  assert.equal(extractClaim('Offset purchase of 4 000 tCO2e').quantity, 4000);
  assert.equal(extractClaim('Offset purchase of 4 000 tCO2e').quantity, 4000);
});

test('reads European decimal comma format', () => {
  assert.equal(extractClaim('1.234,5 tCO2e were retired').quantity, 1234.5);
  assert.equal(extractClaim('2.500 tCO2e retired, 1.234.567 tCO2e total').quantity, 2500);
});

test('reads "thousand" and German Tonnen', () => {
  assert.equal(extractClaim('approximately 33 thousand tonnes of CO2e').quantity, 33000);
  assert.equal(extractClaim('750 Tonnen CO2e stillgelegt').quantity, 750);
});
