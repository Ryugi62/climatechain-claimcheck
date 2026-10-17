// judge(): compare an extracted claim with registry records and the ledger.
const ORDER = ['MATCH', 'MISMATCH', 'NOT_FOUND', 'DUPLICATE']; // later = worse

function judgeSerial(range, record, ledger, claimant, sourceError) {
  const line = { serial: range.raw, registry: range.registry, quantity: range.quantity };
  const dup = ledger.conflicts(range, claimant);
  if (dup.length) {
    return { ...line, verdict: 'DUPLICATE', reason: 'already_claimed', overlap: dup.reduce((a, d) => a + d.overlap, 0), firstClaimant: dup[0].claimant };
  }
  if (sourceError) return { ...line, verdict: 'NOT_FOUND', reason: 'source_error', detail: sourceError };
  if (!record) {
    return { ...line, verdict: 'NOT_FOUND', reason: range.registry === 'GOLD_STANDARD' ? 'not_in_records' : 'registry_not_supported' };
  }
  const evidence = { source_url: record.source_url ?? null, fetched_at: record.fetched_at ?? null, status: record.status, number_of_credits: record.number_of_credits };
  if (record.status !== 'RETIRED') return { ...line, verdict: 'MISMATCH', reason: 'not_retired', evidence };
  if (record.number_of_credits != null && record.number_of_credits !== range.quantity) {
    return { ...line, verdict: 'MISMATCH', reason: 'record_range_differs', evidence };
  }
  return { ...line, verdict: 'MATCH', reason: 'retired', evidence };
}

export function judge({ claim, claimant, lookup, ledger, errors = {} }) {
  if (!claim.serials.length) return { verdict: 'NO_SERIAL', reason: 'no_serial', lines: [], quantity: { claimed: claim.quantity, registry: null } };
  const lines = claim.serials.map((s) => judgeSerial(s, lookup(s), ledger, claimant, errors[s.raw]));
  let verdict = 'MATCH';
  let reason = 'retired';
  for (const l of lines) if (ORDER.indexOf(l.verdict) > ORDER.indexOf(verdict)) { verdict = l.verdict; reason = l.reason; }
  const registrySum = lines.reduce((a, l) => a + l.quantity, 0);
  const quantity = { claimed: claim.quantity, registry: registrySum };
  if (verdict === 'MATCH' && claim.quantity != null && claim.quantity !== registrySum) {
    verdict = 'MISMATCH'; reason = 'quantity_differs';
  }
  if (verdict === 'MISMATCH' && reason === 'retired') reason = 'quantity_differs';
  return { verdict, reason, lines, quantity };
}
