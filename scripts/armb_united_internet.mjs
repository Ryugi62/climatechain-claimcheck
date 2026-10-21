// Arm B (search-first): the one real company-written sentence that equals a Gold Standard record. Output: data/reports2/armB-united-internet.json
import fs from 'node:fs';
import { checkBeneficiary } from '../src/application/checkBeneficiary.mjs';
import { goldStandardLive } from '../src/adapters/goldStandardLive.mjs';
const SENTENCE = 'In fiscal year 2024, the Business Access Segment retired 4,713 Gold Standard-compliant verified emission reductions (VERs).';
const URL_ = 'https://report.united-internet.de/sustainability/2024/environment/climate-change-mitigation-and-climate-change/ghg-removals-and-ghg-mitigation-projects-financed-through-carbon-credits.html';
const registry = goldStandardLive(fetch, { headers: { 'User-Agent': 'Mozilla/5.0 (claimcheck research sample)' } });
const out = { measuredAt: new Date().toISOString(), source: URL_, sentence: SENTENCE, note: 'Sentence copied verbatim from the web page (United Internet Sustainability Report 2024). The segment is named, not the legal entity; United Internet describes its Business Access segment as the business of 1&1 Versatel (annual reports 2014, 2015, 2021, 2023). We therefore look up "1&1 Versatel".', runs: {} };
for (const claimant of ['United Internet', '1&1 Versatel']) {
  const r = await checkBeneficiary({ text: SENTENCE, claimant }, { registry });
  out.runs[claimant] = { status: r.status, relation: r.relation || null, claimed: r.claimed, total: r.total, candidates: r.candidates.map((c) => ({ serial: c.serial_number, credits: c.number_of_credits, vintage: c.vintage, retired_on: c.retired_on || null, beneficiary: c.beneficiary || c.note || null, source_url: c.source_url })) };
  console.log(claimant, r.status, r.claimed, r.total, r.candidates.length);
}
fs.writeFileSync('data/reports2/armB-united-internet.json', JSON.stringify(out, null, 1) + '\n');
