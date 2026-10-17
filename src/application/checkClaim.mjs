import { extractClaim } from '../domain/claim.mjs';
import { judge } from '../domain/reconcile.mjs';

// ports: records.find(serialRange) -> Promise<record|null>, ledger (domain Ledger)
export async function checkClaim({ text, claimant = 'anonymous', commit = false }, { records, ledger }) {
  const claim = extractClaim(text);
  const found = new Map();
  const errors = {};
  for (const s of claim.serials) {
    try { found.set(s.raw, await records.find(s)); }
    catch (e) { found.set(s.raw, null); errors[s.raw] = String(e && e.message || e); }
  }
  const result = judge({ claim, claimant, ledger, errors, lookup: (s) => found.get(s.raw) ?? null });
  if (commit && result.verdict === 'MATCH') {
    for (const s of claim.serials) ledger.register(s, claimant);
  }
  return result;
}
