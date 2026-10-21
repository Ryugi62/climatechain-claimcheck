// Sentence without a serial: find registry records that name the company as beneficiary. Pure functions, no I/O.
import { extractClaim } from './claim.mjs';

const SUFFIX = new Set(['ltd', 'limited', 'llc', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'plc', 'ag', 'as', 'asa', 'ab', 'se', 'sa', 'nv', 'bv', 'gmbh', 'oy', 'the', 'group']);

export function nameTokens(name) {
  const t = String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  while (t.length > 1 && SUFFIX.has(t[t.length - 1])) t.pop();
  if (t.length > 1 && t[0] === 'the') t.shift();
  return t;
}

const startsWith = (tokens, prefix) => prefix.length > 0 && prefix.length <= tokens.length && prefix.every((p, i) => tokens[i] === p);

/** Names a record gives for the party the credits were retired for. */
export function beneficiaryNames(rec) {
  const names = [];
  const e = rec && rec.retirement_using_entity;
  if (e && e.name) names.push(e.name);
  const note = String((rec && rec.note) || '');
  if (note && note.length <= 80) names.push(note); // a bare note such as "Netflix, Inc."
  for (const m of note.matchAll(/\b(?:on behalf of|for)\s+([^,.;:()]+)/gi)) names.push(m[1]);
  return names;
}

/** A candidate: RETIRED, and the claimant is the leading words of a beneficiary name (so "Shenzhen Apple Brother" is not Apple). */
export function isCandidate(rec, claimant) {
  if (!rec || String(rec.status).toUpperCase() !== 'RETIRED') return false;
  const want = nameTokens(claimant);
  return beneficiaryNames(rec).some((n) => startsWith(nameTokens(n), want));
}

const retirementYear = (r) => (r.updated_at ? Number(String(r.updated_at).slice(0, 4)) : null);

function yearOf(text) {
  const t = String(text);
  const years = new Set();
  for (const m of t.matchAll(/\b(?:FY|fiscal year\s*)\s?'?(\d{4}|\d{2})\b/gi)) years.add(m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]));
  for (const m of t.matchAll(/\b(?:19|20)\d{2}\b/g)) years.add(Number(m[0]));
  return years.size === 1 ? [...years][0] : null; // a period like 2019-2022 is not one year: no year filter
}

const PRONOUN = new Set(['we', 'i', 'our', 'they', 'it', 'the', 'this', 'that', 'these', 'those', 'all', 'credits', 'company', 'group']);

function companyFrom(text) {
  const CAP = "[A-Z][\\w&'\\-]*";
  let m = new RegExp(`\\bon behalf of\\s+(${CAP}(?:\\s+${CAP}){0,2})`).exec(text);
  if (m) return m[1];
  m = new RegExp(`(?:^|[.,;]\\s*|\\bIn \\d{4},?\\s+)(${CAP}(?:\\s+${CAP}){0,2})\\s+(?:has |have )?(?:retired|offset)\\b`).exec(text);
  return m && !PRONOUN.has(m[1].toLowerCase()) ? m[1] : '';
}

/** The claim without a serial: company (explicit claimant first), year, quantity. */
export function extractBeneficiaryClaim(text, claimant = '') {
  const base = extractClaim(text);
  const given = String(claimant || '').trim();
  const name = given && given.toLowerCase() !== 'anonymous' ? given : companyFrom(String(text || ''));
  return { text: String(text || ''), claimant: name, year: yearOf(base.serials.length ? '' : text), quantity: base.quantity, hasSerial: base.serials.length > 0 };
}

const view = (r) => ({
  serial_number: r.serial_number, number_of_credits: r.number_of_credits, vintage: r.vintage, status: r.status,
  retired_on: r.updated_at ? String(r.updated_at).slice(0, 10) : null,
  beneficiary: (r.retirement_using_entity && r.retirement_using_entity.name) || null, note: r.note || null,
  project_name: r.project_name || (r.project && r.project.name) || null, source_url: r.source_url || null,
});

export function judgeBeneficiary({ claim, records }) {
  if (!claim.claimant) return { status: 'NO_CLAIMANT', reason: 'no_company_name', candidates: [], total: 0, claimed: claim.quantity, year: claim.year, yearScope: null };
  const all = (records || []).filter((r) => isCandidate(r, claim.claimant));
  if (!all.length) return { status: 'NOT_FOUND', reason: 'no_candidate', claimant: claim.claimant, candidates: [], total: 0, claimed: claim.quantity, year: claim.year, yearScope: null };
  let used = all, yearScope = 'all';
  if (claim.year) {
    const inYear = all.filter((r) => retirementYear(r) === claim.year || Number(r.vintage) === claim.year);
    if (inYear.length) { used = inYear; yearScope = 'year'; }
  }
  const total = used.reduce((a, r) => a + Number(r.number_of_credits || 0), 0);
  const base = { claimant: claim.claimant, candidates: used.map(view), allCandidates: all.length, total, claimed: claim.quantity, year: claim.year, yearScope };
  if (claim.quantity == null) return { ...base, status: 'NO_QUANTITY', reason: 'sentence_has_no_quantity' };
  if (total === claim.quantity) return { ...base, status: 'MATCH', reason: 'total_equals_quantity' };
  return { ...base, status: 'MISMATCH', reason: 'total_differs', relation: total < claim.quantity ? 'registry_lower' : 'registry_higher' };
}
