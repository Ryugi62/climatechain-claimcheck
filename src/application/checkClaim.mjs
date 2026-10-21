import { extractClaim } from '../domain/claim.mjs';
import { judge } from '../domain/reconcile.mjs';
import { claimHashOf } from '../domain/chainAbi.mjs';

// ports: records.find(serialRange) -> Promise<record|null>, ledger (domain Ledger),
// optional chain.overlaps(serialRange) -> Promise<[{start,end,claimHash,attestor}]> (reads the deployed registry),
// optional knownClaims [{claimant, claimHash}] to name who registered a range on chain.
export async function checkClaim({ text, claimant = 'anonymous', commit = false }, { records, ledger, chain = null, knownClaims = [] }) {
  const claim = extractClaim(text);
  const found = new Map();
  const errors = {};
  for (const s of claim.serials) {
    try { found.set(s.raw, await records.find(s)); }
    catch (e) { found.set(s.raw, null); errors[s.raw] = String(e && e.message || e); }
  }
  const chainRows = new Map();
  let chainError;
  if (chain) {
    for (const s of claim.serials) {
      try { chainRows.set(s.raw, await chain.overlaps(s)); } catch (e) { chainError = String(e && e.message || e); }
    }
  }
  const own = new Set([claimHashOf(claimant, text).toLowerCase()]);
  for (const k of knownClaims) if (String(k.claimant).toLowerCase() === String(claimant).toLowerCase()) own.add(String(k.claimHash).toLowerCase());
  const result = judge({ claim, claimant, ledger, errors, lookup: (s) => found.get(s.raw) ?? null, chain: { rows: chainRows, own, known: knownClaims } });
  if (chainError) result.chainError = chainError;
  if (commit && result.verdict === 'MATCH') {
    for (const s of claim.serials) ledger.register(s, claimant);
  }
  return result;
}
