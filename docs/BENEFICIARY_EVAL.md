# Sentence without a serial: does the Gold Standard registry give candidates? (measured 2026-10-21)

Question (review): most real reports print no credit serial (0 of 10, [SERIAL_PREVALENCE.md](SERIAL_PREVALENCE.md)). Can the company, the year and the quantity in the sentence still be compared with a public record?

Answer found in the registry's public read endpoint (`https://public-api.goldstandard.org/credits`, the same one the live lookup uses): every credit block carries `retirement_using_entity` (an object with the company `name`) and a free-text `note` (for example "Retired by Cool Effect on behalf of Google LLC"); the free-text `query` parameter searches them, and the response headers `X-Total-Count` and `X-Total-Number-Of-Credits` give the number of blocks and credits. Not every retired block names a beneficiary (privacy or marketplace orders), so a missing candidate is not proof of anything.

Method: the same 10 public reports as the serial measurement. For each report the retirement sentences were copied verbatim into `data/reports/sentences.json` (regex pass for retire/offset near a quantity, then a manual read; the file was written before the matcher ran on it). The product code `checkBeneficiary` ran live on each sentence with the publisher as claimant; Gold Standard answers are cached in `data/reports/gs-beneficiary-cache.json`. Re-make: `node scripts/eval_beneficiary.mjs` (live) or `--offline` (from the cache).

Sample status: these 10 reports are the sample we used for the serial question, so they are in-sample for that finding. For the beneficiary path they are first-time sentences: the matcher was written from the API fields and a fixture of three companies (Google, Apple, Storebrand), not from these sentences. One thing the first run did teach us: "605,354 metrics tons" (Microsoft) was not read as a quantity, so the unit was added with a test.

| Report | Claimant | Sentences | Result of the registry lookup (sentence) | Company alone: retired blocks / credits on Gold Standard |
|---|---|---|---|---|
| Microsoft | Microsoft | 1 | 605,354 t: 14 candidates, total 27,021 t, registry lower | 14 / 27,021 |
| Apple | Apple | 2 | 324,100 t: no candidate; 167,000 t: no candidate | none found |
| Google | Google | 0 | no retirement sentence with a quantity | 2 / 131,201 |
| easyJet (annual report FY24, sustainability section) | easyJet | 0 | no retirement sentence with a quantity | 34 / 416,303 |
| easyJet (2022 sustainability extract of the annual report) | easyJet | 1 | 11,767,387 t: 34 candidates, total 416,303 t, registry lower | 34 / 416,303 |
| Commerzbank (non-financial report 2023) | Commerzbank | 0 | no retirement sentence with a quantity | none found |
| Storebrand (annual report 2023) | Storebrand | 0 | no retirement sentence with a quantity | 1 / 50 |
| Storebrand (carbon footprint report 2023) | Storebrand | 0 | no retirement sentence with a quantity | 1 / 50 |
| AIXTRON (sustainability report 2023) | AIXTRON | 0 | no retirement sentence with a quantity | none found |
| Netflix (ESG report 2024) | Netflix | 0 | no retirement sentence with a quantity | 15 / 128,506 |

**Result: 3 of 10 reports contain a retirement sentence with a quantity; 2 of 10 reports get at least one registry candidate for their sentence; 0 of 10 have a candidate total equal to the sentence.** Separately, 7 of 10 reports are from a company that has retired blocks under its own name on Gold Standard (Microsoft, Google, easyJet x2, Storebrand x2, Netflix); Commerzbank and AIXTRON have none, and Apple has none (a homonym, "Shenzhen Apple Brother Technology", is correctly not a candidate).

What this means:
- With no serial the product can still say "the registry lists N blocks, X t retired for this company" and whether X equals the sentence. In these reports X was lower than the sentence every time it was found: a lower total is not a finding of over-claiming: the Apple report footnotes name VCS/CCB (Verra) projects and the Microsoft sentence is about removal credits, and this product looks up Gold Standard only.
- It is a lead, not a verdict: the five serial verdicts are unchanged, and a sentence without a serial still returns No serial.
- Sample is 10 reports chosen by us, 4 sentences, 3 reports with a sentence. Read it as what the path does on real text, not as a hit rate.
