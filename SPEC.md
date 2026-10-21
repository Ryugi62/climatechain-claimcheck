# SPEC — ClaimCheck

## 1. Purpose (목적)
Given one sentence from an ESG / sustainability report that claims a carbon offset ("We retired 33,131 tCO2e, serial GS1-1-MZ-GS7643-16-2025-31135-1059-34189"), tell the reader in under 2 seconds whether

1. the credit serial named in the sentence exists in a public registry and is recorded as **retired**,
2. the quantity in the sentence matches the quantity of that serial range, and
3. the same credits were **not already claimed** by an earlier claim.

An on-chain registry contract makes (3) enforceable: registering a serial range that overlaps an already registered range for the same batch reverts.

4. **(Narrative check, added 2026-10-21)** whether the *wording* around the serial (business type, country, vintage/year, who retired, how many) is supported by the registry record, shown next to the verdict as **Backed**, **May conflict** or **No receipt**. This is a helper display. It never changes the verdict.

5. **(Sentence without a serial, added 2026-10-21)** when the sentence names no serial, find the Gold Standard retirement records that list the company as the beneficiary (`retirement_using_entity.name`, or a note "on behalf of <company>") and compare their total with the quantity in the sentence. The result is a list of **candidates** with a total, never a proof, and it never changes the five verdicts above.

6. **(Chain read, added 2026-10-21)** the "already claimed" test (3) can be answered by *reading the deployed registry contract* instead of the page's own memory. The page then shows Double use only because the contract says the range is taken.

Hackathon track: Track 1, Carbon Markets & Emissions Transparency (double counting, lack of transparency).

## 2. Non-goals (비목표)
- No token, no minting of carbon credits, no trading, no price, no investment feature.
- No model training. Claim parsing is deterministic (rules), not a learned model. The verdict (MATCH, MISMATCH, NOT_FOUND, DUPLICATE, NO_SERIAL) is produced by the rules and the ledger only; the narrative check never feeds into it.
- The narrative check runs a pre-trained natural-language-inference model (Xenova/nli-deberta-v3-xsmall, int8) for inference only in the viewer's browser. We do no training, no fine-tuning, no server. It is off the verdict path and can be switched off by the `NARRATIVE` feature flag.
- No paid API, no paid RPC, no mainnet. Local Hardhat chain for tests; the only public chain is the free Sepolia testnet (free public RPC, free faucet ETH, no real funds); registry data only from free public endpoints.
- No personal data. Only public serial numbers and project names.
- No judgement of project quality (additionality, permanence). We only check "retired? how many? twice?".
- Not an audit opinion. A MATCH means "the public record agrees with the sentence", nothing more.

## 3. Ubiquitous language (code names = these words)
| Term | Meaning |
|---|---|
| Claim | One sentence plus a claimant id |
| Serial | Registry serial string, e.g. `GS1-1-MZ-GS7643-16-2025-31135-1059-34189` |
| SerialRange | Parsed serial: registry, batchKey, start, end, quantity |
| RegistryRecord | One public registry row: serial, status, quantity, source URL, fetch date |
| Ledger | Set of already registered ranges per batchKey (domain mirror of the contract) |
| Narrative | The sentence with serials removed (what is left to say about the credit) |
| RecordText | A registry record rendered as plain sentences (project, country, vintage, quantity, status) |
| Receipt | The label of the narrative check: `BACKED` (record entails the narrative), `MAY_CONFLICT` (record contradicts it), `NO_RECEIPT` (neither, or no record) |
| Beneficiary | The company a registry record names as the party the credits were retired for (field `retirement_using_entity.name` or a note "on behalf of ...") |
| Candidate | A RETIRED registry record whose Beneficiary equals the claimant (whole leading words, legal suffix ignored) |
| BeneficiaryResult | `MATCH` (candidate total equals the quantity), `MISMATCH` (total lower or higher), `NOT_FOUND` (no candidate), `NO_CLAIMANT` (no company name in input), `NO_QUANTITY` (candidates listed, sentence has no quantity) |
| Verdict | `MATCH`, `MISMATCH`, `NOT_FOUND`, `DUPLICATE`, `NO_SERIAL` |
| Attestor | Address allowed to register a range on chain |
| BatchKey | `registry : project : vintage : batch`, hashed on chain |

## 4. Architecture (dependencies point inward only)
`domain/` (pure functions, no I/O) <- `application/` (use case `checkClaim`, ports) <- `adapters/` (sample-file record source, Gold Standard HTTP source, browser UI) <- `infrastructure/` (Hardhat, GitHub Pages build). Solidity contract is a separate bounded context mirrored by `Ledger`.

## 5. Behaviour (Given / When / Then)
- **G1 Match.** Given a registry record with status RETIRED and quantity 33,131, when the claim names that serial and says 33,131 tCO2e, then verdict MATCH.
- **G2 Not retired.** Given the record exists with status ISSUED, when a claim says it retired that serial, then verdict MISMATCH with reason `not_retired`.
- **G3 Quantity.** Given a RETIRED record of 33,131 credits, when the claim says 40,000 t, then verdict MISMATCH with reason `quantity_differs` and both numbers in the result.
- **G4 Unknown serial.** Given no record for the serial in the record source, then verdict NOT_FOUND (meaning "not in the records we hold", never "fake").
- **G5 Double use.** Given the ledger holds a range of claimant A, when claimant B claims an overlapping range of the same batch, then verdict DUPLICATE with the overlapping credit count; the same claimant re-checking its own claim is not a duplicate.
- **G6 No identifier.** Given a sentence without any serial, then verdict NO_SERIAL (nothing to verify).
- **G7 Contract refuses.** Given a registered range [a,b] in batch K, when an attestor registers [c,d] in K with c <= b and d >= a, then the transaction reverts with `RangeOverlap`; adjacent ranges (c = b+1) succeed; the same numbers in another batch succeed.
- **G8 Authority.** Given a non-attestor address, when it calls `register`, then the transaction reverts with `NotAttestor`.
- **G9 Many serials.** Given a claim with several serials, then the claim verdict is the worst one in the order DUPLICATE > NOT_FOUND > MISMATCH > MATCH and every serial keeps its own line.
- **G10 Foreign format.** Given a Verra-style VCU serial, then it is parsed (registry VERRA) but, with no Verra record source, the verdict is NOT_FOUND with reason `registry_not_supported`.

- **G11 Backed.** Given a record text and a narrative the record entails, then receipt BACKED; the verdict is unchanged.
- **G12 May conflict.** Given a narrative that changes the project type, country or year of the record, when the NLI contradiction probability is >= 0.97, then receipt MAY_CONFLICT; wording says "may", never "fake".
- **G13 No receipt.** Given no registry record (NOT_FOUND, NO_SERIAL, unsupported registry), or a narrative the record neither supports nor contradicts, then receipt NO_RECEIPT.
- **G14 Isolation.** Given the same input with the narrative check on or off, then the verdict, reason and lines are identical (regression 0).

- **G15 Candidates by beneficiary.** Given RETIRED records whose beneficiary is "Google LLC" (two blocks, 61,544 and 69,657 credits), when the sentence has no serial, names Google and says 131,201 tCO2e, then BeneficiaryResult MATCH with candidates 2 and total 131,201.
- **G16 Quantity differs.** Given the same two records, when the sentence says 500,000 t, then MISMATCH with relation `registry_lower`, total and claimed both in the result; when it says 100,000 t, relation `registry_higher`.
- **G17 Homonym is not a candidate.** Given a record retired for "Shenzhen Apple Brother Technology Co.", when the claimant is Apple, then it is not a candidate (the claimant must be the leading words of the beneficiary name).
- **G18 Not found / no claimant.** Given no candidate, then NOT_FOUND ("not in the records we hold", never "fake"); given no company name in the input, then NO_CLAIMANT.
- **G19 Year.** Given a year in the sentence, then candidates whose retirement year or vintage equals it are summed when there are any; otherwise all candidates are summed and the result says so (`year_scope: all`).
- **G20 Isolation.** Given a sentence with a serial, the beneficiary path is not used; given a sentence without one, `checkClaim` still returns NO_SERIAL (regression 0). Only RETIRED records count.
- **G21 One credit, one story.** Given a candidate from G15, when its serial range is registered on chain and a second claimant registers an overlapping range, then the transaction reverts with `RangeOverlap` (G7) and the web page shows the same serial in the sentence check and in the chain record.

- **G22 Chain read.** Given a range registered on the contract (batch K, [a,b], claimHash h), when claimant B checks a sentence with a serial range in K that overlaps [a,b], and h is neither B's own claim hash nor the hash of a known claim by B, then the verdict is DUPLICATE with `source: chain`, the overlap in credits and the stored claimHash; the chain is read through `conflictsWith`, `rangeCount`, `rangeAt` (no transaction, no wallet).
- **G23 Own claim.** Given the range was registered under a claim hash that is known to belong to claimant B (hash of `claim:<B>:<sentence>` for the sentence being checked, or an entry of the known-claims list), when B checks it, then the chain does not make it DUPLICATE (verdict by the normal rules).
- **G24 Chain unreachable.** Given the RPC fails, then the verdict is exactly what it is without the chain port and the result carries `chainError`; the chain never turns a failure into DUPLICATE and never changes MISMATCH/NOT_FOUND into MATCH.
- **G25 No chain port.** Given no chain port, then every result is identical to before (regression 0; the local Ledger still answers G5).
- **G27 Quality words before a credit unit.** Given "retired 4,713 Gold Standard-compliant verified emission reductions", then the quantity is 4,713; given "4,713 Gold Standard auditors", then no quantity.
- **G26 Same encoding.** The batch key is hashed on chain as keccak256 of the UTF-8 string `registry:project:vintage:batch`; the JS keccak and ABI encoding in the page equal ethers' output for the same inputs (checked in tests), so the page asks the contract the same question a wallet would.
- **G28 Limit next to the verdict.** Given any MATCH card (serial check or beneficiary total), then the card carries the line "Not an audit · Gold Standard record only" (text from `src/domain/disclosure.mjs`). Verdict, reason and every number stay exactly as before (display text only; regression 0 in G1-G27).
- **G29 Error rates on the wording box.** Given the bundled measurement `docs/data/narrative.json` (72 frozen pairs), then the wording-check box title reads "changes caught 10/36 · false alarms 1/36" with the same two counts as `docs/NARRATIVE_EVAL.md`; the numbers are computed from the file, not typed.
- **G30 Real-harm numbers.** Given the stored runs on real report sentences (`data/reports/beneficiary-results.json`, `data/reports2/results.json`), when `scripts/impact_numbers.py` runs, then it prints N (sentences with a quantity), A (tonnes claimed), B (tonnes covered by retired Gold Standard blocks of the same company, per sentence min(claimed, registry total)), C = A - B, and the exact-match count; README and the submission text quote these printed values only.

### Who registers, and why (adoption path; design, partly out of scope)
The registrant is the party that checks reports for others: an assurance provider or auditor who verifies a report's offset sentence against the public record and then writes the range to the registry. Its reason is liability: it signs "these credits back claim X" and wants to see in public that nobody else was told the same. A reporting company can register nothing itself (the contract admits only attestors). Today the attestor set is one owner address in the prototype (see Limits). Designed, not built: the owner role moves to a 2-of-3 multisig of independent assurance providers and `register` needs two attestor signatures; this changes the contract and the deployed Sepolia address and is outside the scope of this change (no G/W/T above depends on it).

## 6. Numeric success conditions (성공 조건; measured, not promised)
| # | Condition | Measured by |
|---|---|---|
| S1 | Domain unit tests >= 30, all pass | `npm run test:domain` |
| S2 | Contract tests >= 25, all pass on the local Hardhat network | `npm run test:contract` |
| S3 | >= 100 real public registry records stored with source URL and fetch date | `data/gs/credits-sample.json` |
| S4 | On a claim set built from those records (all five verdict types), verdict accuracy reported with counts per verdict | `npm run eval` -> `data/eval/results.json` |
| S5 | Extraction check on >= 12 hand-written phrasings not used to build the parser: serial recall and quantity recall reported | `npm run eval` |
| S6 | Live demo page opens with no wallet, no login; pasted sentence returns a verdict in < 2 s from bundled records | public URL, HTTP 200 |
| S7 | Numbers shown in README equal numbers in `results.json` (checked by a test) | `npm run test:domain` |
| S9 | Narrative eval set: >= 30 labelled (record text, narrative) pairs, built from real documents (the 24 real-certificate extraction samples) plus narratives with one fact changed, written before any model run and frozen | `data/narrative/pairs.json`, `npm run eval:narrative` |
| S10 | On matching pairs, `MAY_CONFLICT` false alarms <= 10% | `docs/NARRATIVE_EVAL.md` |
| S11 | On matching pairs, `BACKED` reproduced >= 70% | `docs/NARRATIVE_EVAL.md` |
| S12 | One narrative checked in <= 2 s after the model is loaded (model load time reported separately) | `docs/NARRATIVE_EVAL.md`, headless browser run |
| S13 | All existing tests still pass, plus new narrative tests (written first, seen failing) | `npm test` |
| S14 | Beneficiary path: >= 12 new unit tests written first and seen failing; on the 10 real reports of `docs/SERIAL_PREVALENCE.md` report how many reports have a retirement sentence, how many of those get >= 1 candidate, how many totals equal the sentence (honest, including 0) | `docs/BENEFICIARY_EVAL.md` |
| S15 | One real Gold Standard range goes sentence -> candidate -> Sepolia registration -> second claim reverts, with tx hashes | `docs/flow-testnet.json` |
| S16 | The gas gap between the local chain (162k) and Sepolia (684k) is explained by measurement: same bytecode, same calldata, same slot count, per-slot price ratio; README states it and no claim says "not investigated" | `docs/gas-diagnosis.json`, `tests/domain/gas-diagnosis.test.mjs` |
| S17 | Chain read: >= 10 new tests written first and seen failing (keccak and ABI equal ethers, G22-G25, adapter against the local Hardhat chain); one real Sepolia read shows Company B DUPLICATE from the contract | `npm test`, `docs/chain-read-sepolia.json` |
| S18 | Wider real-sentence sample: >= 30 first-time public reports chosen by a rule written in `docs/REAL_SENTENCE_HUNT.md`; count of reports with a retirement sentence, with candidates and with an equal total, honest including 0; a search-first match is reported separately and never counted in n/30 | `docs/REAL_SENTENCE_HUNT.md`, `data/reports2/results.json`, `tests/domain/hunt.test.mjs` |
| S19 | Display disclosure and harm numbers: G28-G30 tests written first and seen failing; README first screen shows problem, solution, <= 5 evidence numbers and one limit line | `tests/domain/disclosure.test.mjs`, `docs/IMPACT_NUMBERS.txt` |
| S8 | Cost per registration on chain reported in gas | contract test output |

### Pre-registration for S9-S12 (2026-10-21, before any model run)
- Thresholds are frozen from a different project's dev data (entail >= 0.70, contradict >= 0.97); they are not tuned on this set.
- Kill: if S10-S12 are not met by 2026-10-22 18:00 KST, the `NARRATIVE` flag is switched off in the shipped page and every claim of a narrative check is removed from README and submission text. Only this task's own numbers are reported.
- Numbers of the earlier project (Receipts) are not reused anywhere.

## 7. Limits stated up front
- Only Gold Standard records are fetched. Verra's search is browser-only; no stable free API was found (see README).
- Rule-based extraction misses unusual wordings; recall is reported, not hidden.
- The narrative check is a small pre-trained model: it can miss a changed number and can be wrong on unusual wording. Its recall on changed facts is reported next to its false alarms. It needs a one-time model download (about 90 MB) from huggingface.co after a click; everything else works offline from the bundled files.
- Tests run on a local Hardhat network. The same contract is deployed on the Sepolia testnet (address in README); trust sits in the attestor set.
- The bundled record sample is a small sample, not a mirror of the registry. Live lookup (one request per serial) is available when the viewer's browser can reach the registry.

## 8. UI acceptance (UI 수용기준)
Copied from the 10-point checklist and made concrete for the single page `docs/index.html`:
1. Mobile first: no horizontal scroll at 390 px and 1280 px; viewport meta present; zoom not blocked.
2. One question per screen: one textarea, one primary action ("Check claim"); options are secondary.
3. Type scale: body 16 px, helper text 13-14 px, verdict 32 px bold; line height >= 1.5; nothing under 12 px.
4. Spacing on a 4/8 grid (>= 80%), card radius >= 16 px, side gutters >= 16 px.
5. Primary button height >= 52 px; every tap target >= 44 px.
6. Number/verdict first: the result card starts with the verdict in large type, reasons below.
7. Evidence folded: measured-results table is in a closed `<details>`; per-serial source URL and date sit under each result line.
8. Microcopy: plain, active, positive; errors say cause and what to do ("The registry could not be reached. Untick live lookup to use the stored sample.").
9. Colour: white/neutral background, one brand colour plus two state colours, text contrast >= 4.5:1 in light and dark, visible focus.
10. No external fonts, scripts or CDN; loading and error states are shown. The only external request is the opt-in model download for the narrative check (button "Check wording"), which states size and source before it starts.
Checked with `python3 ui_audit.py docs/index.html` (0 fail, 0 warn) before release.
