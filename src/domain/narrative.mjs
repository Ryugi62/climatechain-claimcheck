import { maskSerials } from './serial.mjs';

// Narrative check (SPEC section 5, G11-G14). Pure functions: no I/O, no model. The model sits behind the port in application/checkNarrative.mjs.
// Thresholds are frozen (SPEC pre-registration); they come from another project's dev data, not from the S9 pair set.
export const THRESHOLDS = Object.freeze({ entail: 0.7, contradict: 0.97 });

export const RECEIPT = Object.freeze({ BACKED: 'BACKED', MAY_CONFLICT: 'MAY_CONFLICT', NO_RECEIPT: 'NO_RECEIPT' });
export const RECEIPT_LABEL = Object.freeze({ BACKED: 'Backed', MAY_CONFLICT: 'May conflict', NO_RECEIPT: 'No receipt' });

let regions = null;
function countryName(code) {
  if (!code) return null;
  try { regions ??= new Intl.DisplayNames(['en'], { type: 'region' }); return regions.of(String(code).toUpperCase()); } catch { return String(code); }
}

/** A registry record as plain sentences, the premise for the NLI model. */
export function recordText(r) {
  const parts = [];
  const retired = String(r.status || '').toUpperCase() === 'RETIRED';
  const n = Number(r.number_of_credits);
  const country = countryName(r.country_code);
  if (r.project_name) parts.push(`Project: ${r.project_name}.`);
  if (country) parts.push(`The project is in ${country}.`);
  if (r.vintage) parts.push(`The credits are of vintage ${r.vintage}.`);
  if (Number.isFinite(n)) parts.push(`${n.toLocaleString('en-US')} credits ${retired ? 'were retired' : 'were issued and are not retired'}.`);
  else parts.push(retired ? 'The credits were retired.' : 'The credits were issued and are not retired.');
  return parts.join(' ');
}

/** The sentence with serial numbers removed: what is left to say about the credit. */
export function narrativeOf(text) {
  if (typeof text !== 'string') return '';
  return maskSerials(text)
    .replace(/\(\s*(?:serial(?:\s+(?:number|no\.?))?|vcu serial(?:\s+number)?)\s*:?\s*\)/gi, ' ')
    .replace(/[,;:]?\s*\bserials?(?:\s+(?:numbers?|no\.?))?\s*[:,]?\s*(?=[.,;)]|$)/gi, ' ')
    .replace(/\s+([.,;)])/g, '$1').replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[\s,.;:]+$/, '');
}

/** inference = {entail, contradict, neutral} probabilities -> receipt. */
export function classifyReceipt(inf, t = THRESHOLDS) {
  if (inf.entail >= t.entail) return RECEIPT.BACKED;
  if (inf.contradict >= t.contradict) return RECEIPT.MAY_CONFLICT;
  return RECEIPT.NO_RECEIPT;
}
