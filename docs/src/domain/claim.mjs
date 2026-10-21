import { findSerials, stripSerials } from './serial.mjs';

// number + unit. Units: t, tCO2(e), tonnes, tons, kt, Mt, credits, VCUs, VERs, "million tonnes"
const NUM = '(\\d{1,3}(?:\\.\\d{3})+,\\d+|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d{1,3}(?:\\.\\d{3})+(?!\\d)|\\d+(?:[.,]\\d+)?)';
const UNIT = '(?:\\s*(million|thousand|m)\\b)?\\s*(verified\\s+carbon\\s+units?|verified\\s+emission\\s+reductions?|mtco2e?|ktco2e?|tco2e?|tonnes?|tons?|tonnen|metrics?\\s+tons?|mt|kt|t|(?:carbon\\s+)?credits?|vcus?|vers?)(?![a-z])';
const QTY_RE = new RegExp(`${NUM}${UNIT}`, 'i');

function parseNumber(t) {
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  if (/^\d{1,3}([ \u00a0\u202f]\d{3})+$/.test(t)) return Number(t.replace(/[ \u00a0\u202f]/g, ''));
  return Number(t.replace(',', '.'));
}

const clean = (s) => s.replace(/₂/g, '2').replace(/CO\s*2/gi, 'CO2');

export function extractClaim(text) {
  if (typeof text !== 'string' || !text.trim()) return { serials: [], quantity: null, text: '' };
  const serials = findSerials(text);
  const body = clean(stripSerials(text));
  let quantity = null;
  const g = new RegExp(QTY_RE.source, 'gi');
  let m;
  while ((m = g.exec(body))) {
    const before = body.slice(Math.max(0, m.index - 1), m.index);
    if (/[\d.,-]/.test(before)) continue;
    let n = parseNumber(m[1]);
    const unit = m[3].toLowerCase().replace(/\s+/g, '');
    if (m[2]) n *= m[2].toLowerCase() === 'thousand' ? 1e3 : 1e6;
    else if (unit.startsWith('mt')) n *= 1e6;
    else if (unit.startsWith('kt')) n *= 1e3;
    quantity = Math.round(n * 1000) / 1000;
    break;
  }
  return { serials, quantity, text };
}
