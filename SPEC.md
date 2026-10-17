# SPEC — ClaimCheck

## 1. Purpose (목적)
Given one sentence from an ESG / sustainability report that claims a carbon offset ("We retired 33,131 tCO2e, serial GS1-1-MZ-GS7643-16-2025-31135-1059-34189"), tell the reader in under 2 seconds whether

1. the credit serial named in the sentence exists in a public registry and is recorded as **retired**,
2. the quantity in the sentence matches the quantity of that serial range, and
3. the same credits were **not already claimed** by an earlier claim.

An on-chain registry contract makes (3) enforceable: registering a serial range that overlaps an already registered range for the same batch reverts.

Hackathon track: Track 1, Carbon Markets & Emissions Transparency (double counting, lack of transparency).

## 2. Non-goals (비목표)
- No token, no minting of carbon credits, no trading, no price, no investment feature.
- No model training. Claim parsing is deterministic (rules), not a learned model.
- No paid API, no paid RPC. Local Hardhat chain only; registry data only from free public endpoints.
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
| S8 | Cost per registration on chain reported in gas | contract test output |

## 7. Limits stated up front
- Only Gold Standard records are fetched. Verra's search is browser-only; no stable free API was found (see README).
- Rule-based extraction misses unusual wordings; recall is reported, not hidden.
- The chain part runs on a local Hardhat network; no public testnet address.
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
10. No external fonts, scripts or CDN; loading and error states are shown.
Checked with `python3 ui_audit.py docs/index.html` (0 fail, 0 warn) before release.
