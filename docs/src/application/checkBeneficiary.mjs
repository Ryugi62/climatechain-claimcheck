import { extractBeneficiaryClaim, judgeBeneficiary } from '../domain/beneficiary.mjs';

// port: registry.findByEntity(companyName) -> Promise<record[]>
export async function checkBeneficiary({ text, claimant = '' }, { registry }) {
  const claim = extractBeneficiaryClaim(text, claimant);
  if (claim.hasSerial) return { status: 'HAS_SERIAL', reason: 'use_the_serial_check', candidates: [], total: 0, claimed: claim.quantity };
  if (!claim.claimant) return judgeBeneficiary({ claim, records: [] });
  let records;
  try { records = await registry.findByEntity(claim.claimant); }
  catch (e) { return { status: 'SOURCE_ERROR', reason: 'source_error', error: String((e && e.message) || e), claimant: claim.claimant, candidates: [], total: 0, claimed: claim.quantity }; }
  return judgeBeneficiary({ claim, records });
}
