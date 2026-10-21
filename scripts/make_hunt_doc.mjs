// docs/REAL_SENTENCE_HUNT.md from data/reports2/*.json, so the document and the numbers cannot drift.
import fs from 'node:fs';
const res = JSON.parse(fs.readFileSync('data/reports2/results.json', 'utf8'));
const reg = JSON.parse(fs.readFileSync('data/reports2/registry-beneficiaries.json', 'utf8'));
const B = JSON.parse(fs.readFileSync('data/reports2/armB-united-internet.json', 'utf8'));
const n = (x) => Number(x).toLocaleString('en-US');
const cell = (r) => {
  if (!r.sentences) return 'no retirement sentence with a quantity';
  return r.results.map((x) => {
    const q = x.result.claimed != null ? `${n(x.result.claimed)} t` : 'no quantity';
    const res_ = x.result;
    if (!res_.candidates.length) return `p.${x.page}: ${q}: no candidate`;
    return `p.${x.page}: ${q}: ${res_.candidates.length} candidates, total ${n(res_.total)} t, ${res_.status === 'MATCH' ? 'equal' : res_.relation === 'registry_lower' ? 'registry lower' : res_.relation === 'registry_higher' ? 'registry higher' : res_.status}`;
  }).join('; ');
};
const b = B.runs['1&1 Versatel'];
const lines = [
  `# Real company sentences: a wider sample, measured ${res.measured}`,
  '',
  'Question (review round 2, all three reviewers): the one sentence we demonstrate was written by us. Do real, company-written retirement sentences ever equal a public Gold Standard record?',
  '',
  '## Selection rule (arm A, registry-first)',
  `1. Source of company names: the Gold Standard public read endpoint, retired blocks whose beneficiary is displayed (\`${reg.query}\`), the first ${reg.pages} pages of ${reg.page_size} in the endpoint's default order, fetched ${reg.fetched}: ${n(reg.blocks_read)} blocks, ${reg.distinct_beneficiaries} distinct beneficiaries (\`data/reports2/registry-beneficiaries.json\`).`,
  '2. Walk the list from the largest total of credits down. Skip: individuals, marketplaces and resellers (for example ClimeCo, Cool Effect), the 10 reports of the first sample, and names whose free public report could not be fetched by a script (Air Canada, Temasek, Computacenter: access denied or blocked; Shell and Lindblad: SEC pages over our 10 MB read limit or a user-agent rule; kept as not read).',
  '3. Take the newest free public report (PDF or web page) that could be downloaded; where a company had two editions we kept both as separate reports. Only free public documents; no login, no paid database.',
  '4. Read the whole text layer (PyMuPDF; web pages stripped of tags), list every sentence with a retirement/offset word and a tonne quantity (`scripts/hunt_extract.py`), then read every hit by hand. Plans, per-year project capacity, SAF certificates and avoided emissions are not retirement sentences. Verbatim sentences are in `data/reports2/sentences.json`; the product (`checkBeneficiary`) ran live on them with the company as claimant (`scripts/eval_hunt.mjs`).',
  '',
  'Bias, stated up front: because the names come from the registry, every company in this sample is one that has retired Gold Standard credits under its own name. The hit rate below is therefore an upper bound for companies in general, not a prevalence.',
  '',
  '| Report | Claimant looked up | Retirement sentences with a quantity | Company alone: retired blocks / credits on Gold Standard |',
  '|---|---|---|---|',
  ...res.rows.map((r) => `| [${r.publisher}](${r.url}) | ${r.claimant} | ${cell(r)} | ${r.company_probe.candidates ? `${r.company_probe.candidates} / ${n(r.company_probe.total)}` : 'none found'} |`),
  '',
  `**Result: ${res.with_sentence} of ${res.reports} reports contain a retirement sentence with a quantity; ${res.sentence_with_candidates} of ${res.reports} get at least one registry candidate for their sentence; ${res.sentence_quantity_equal} of ${res.reports} have a candidate total equal to the sentence.** ${res.company_has_gs_records} of ${res.reports} reports are from a company for which the product finds retired blocks under the name we typed; the other ${res.reports - res.company_has_gs_records} come from the registry list too but under a longer or different spelling (the apoBank report was looked up as "apoBank", the registry names "Deutsche Apotheker- und Ärztebank eG"), which is a limit of name matching.`,
  '',
  'Reading: the nearest miss is Stockholm Exergi (sentence 97,000 t, registry total of 13 candidates 98,266 t; the report value is marked preliminary). The translated sentences (Italian, German, Swedish) were put into English by us for the product run; the verbatim text is in `data/reports2/sentences.json`. A lower registry total is not a finding of over-claiming: the reports buy credits from several registries and the product looks up Gold Standard only.',
  '',
  '## Arm B (search-first), reported separately',
  'Found by a targeted search for sentences that say "retired" next to "Gold Standard" (web search, 2026-10-21), not by the rule above, so it does not count in n/30 and says nothing about how common such a match is.',
  '',
  `- Source: [United Internet, Sustainability Report 2024](${B.source}). Sentence, verbatim: "${B.sentence}"`,
  `- Registry: one retired Gold Standard block of ${n(b.total)} credits, serial \`${b.candidates[0].serial}\`, vintage ${b.candidates[0].vintage}, beneficiary "${b.candidates[0].beneficiary}" (${b.candidates[0].source_url}). Product result: ${b.status}, claimed ${n(b.claimed)} = total ${n(b.total)} with claimant "1&1 Versatel"; with claimant "United Internet" the registry has no candidate (${B.runs['United Internet'].status}), because the sentence names the segment, not the legal entity (United Internet's annual reports describe Business Access as the business of 1&1 Versatel). The page therefore asks for the group company; it cannot discover subsidiaries.`,
  '- What this does not show: the credit is equal in quantity to the sentence; it does not prove that this block is the one the company means (the report gives no serial). It is a lead that agrees with a public record, not an audit.',
  '- On chain: this range was registered on the Sepolia registry (`docs/real-sentence-testnet.json`), so the demo can show a real company sentence, its record and a second claimant refused, with no sentence written by us.',
  '',
];
fs.writeFileSync('docs/REAL_SENTENCE_HUNT.md', lines.join('\n'));
console.log('written docs/REAL_SENTENCE_HUNT.md', lines.length, 'lines');
