# ClaimCheck

**Paste one carbon-offset sentence from an ESG report. With a credit serial, ClaimCheck checks it against public Gold Standard retirement records. Most real reports print no serial (0 of 10 measured), so a sentence with only a company, a year and a quantity is looked up by the company named as beneficiary in the same registry. Either way the same credits can be registered on chain, and a second claim on them is refused. A separate wording check (Backed / May conflict / No receipt) compares the rest of the sentence with the record and never changes the verdict.**

Live demo (no wallet, no login): https://ryugi62.github.io/climatechain-claimcheck/

Deployed on Sepolia testnet: [`0xbBC97a57c7f81F77dbA1b1b2FbC29898b87F7bDF`](https://sepolia.etherscan.io/address/0xbBC97a57c7f81F77dbA1b1b2FbC29898b87F7bDF) (chain 11155111, deployed 2026-10-21; transactions in the Testnet section).

Built for the IEEE ClimateChain Global Hackathon, Track 1 (Carbon Markets and Emissions Transparency: double counting, lack of transparency).

## What is new, and what is not (similar tools)
**Our own part: it starts from the report sentence, with or without a serial. Serial and quantity (or, with no serial, the company's retired blocks and their total) are checked against the public retirement record, and a second claim on the same serial range fails on chain, shown as one flow with one set of credits ([docs/flow-testnet.json](docs/flow-testnet.json)). None of the tools below does all three in one flow; each piece alone exists.** On-chain refusal of reused serials alone is not new (see the patent and EcoGuard rows).

| Tool | Type | What it does | What it does not do |
|---|---|---|---|
| IEEE 3218-2022 / 3234 (blockchain standards by this hackathon's own organiser, https://blockchain.ieee.org/standards) | Standard | Framework and data format for blockchain carbon-market applications | No check of a report sentence (standard text is paywalled; we read its scope only) |
| Climate Action Data Trust (World Bank, IETA, Singapore; https://climateactiondata.org) | Data layer | Aggregates registry metadata to expose double-counting risk | Does not read a company sentence or refuse a second claim; registry-to-registry double counting is its job, not ours |
| Gold Standard and Verra registries (https://registry.goldstandard.org, https://registry.verra.org) | Registry | Status and quantity per serial | Do not read a sentence or compare the claimed quantity |
| CarbonPlan OffsetsDB (https://carbonplan.org/research/offsets-db) | Research database | Project, issuance and retirement snapshots of five registries | Project level; no sentence-to-serial check, no refusal |
| Toucan and similar tokenisation (https://toucan.earth); Verra suspended tokenisation of retired credits on 2022-05-25 | Product | Retired credits as on-chain tokens | No ESG-sentence check |
| EcoGuard on GenLayer (https://github.com/linoxbt/ecoguard) | Code | LLM validators audit project evidence; rejects a duplicate (serial, vintage) issuance | No company report sentence against a public retirement record |
| US11694258B2, Miovision/BlueOwl (https://patents.google.com/patent/US11694258B2/en) | Patent | Serial-level retirement on a blockchain ledger to remove double counting | No sentence check |
| EmeraldMind (https://www.cse.uoi.gr/~tsap/publications/EmeraldMind_WWWDemo.pdf) and Stammbach et al., ACL 2023 (https://aclanthology.org/2023.acl-short.91) | Papers | Greenwashing judgement of ESG sentences; environmental-claim detection | No registry record behind the verdict, no chain |

First-time real sentences (honest numbers, [docs/BENEFICIARY_EVAL.md](docs/BENEFICIARY_EVAL.md)): of the 10 real reports we scanned, 0 print a serial; 3 contain a retirement sentence with a quantity; 2 of those get registry candidates by company name; 0 have a candidate total equal to the sentence (the registry total is lower, Gold Standard only). So the no-serial path gives leads on real text, and an exact quantity match so far only on sentences written from the public record.

Why it matters now: Directive (EU) 2024/825 applies in the EU from 27 September 2026 and targets claims that a product is climate neutral or has reduced climate impact by way of offsetting (text: [EUR-Lex 32024L0825](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024L0825), Art. 4 and recital 12; second source: [EU Transition Pathways](https://transition-pathways.europa.eu/legislation/directive-eu-2024825-empowering-consumer-green-transition)). It applies to consumer-facing claims, not to a company's own ESG report, so it raises the pressure to back offset wording with a record; it is not a rule that ClaimCheck enforces.

Cost to keep running: hosting is static files on GitHub Pages ($0), registry reads are free, a verification costs nothing, and recording one claim on chain is about 2 to 3 US cents on Ethereum L1 at the 2026-10-19 reading and today's mainnet storage price; it may rise if mainnet adopts the schedule Sepolia already uses ([docs/COST.md](docs/COST.md), [docs/gas-diagnosis.json](docs/gas-diagnosis.json)). Next steps: a Verra lookup if a free endpoint appears, and more auditor addresses in the attestor set.

## Measured results (generated by `npm run eval`, file `data/eval/results.json`)
| Item | Number |
|---|---|
| Real registry records stored (Gold Standard public endpoint, fetched 2026-10-17) | 140 (120 retired, 20 issued) |
| Claims checked (built from those rows) | 320: 120 Match, 140 Mismatch, 40 Not found, 20 No serial |
| Verdict as expected | 320/320 (templated sentences, expected verdict known by construction) |
| Quantity inflated by 10%+1 and caught | 120/120 |
| Issued but not retired, caught | 20/20 |
| Second claimant refused by the ledger (same credits) | 60/60 full overlap, 23/23 partial overlap |
| Live endpoint agrees with the stored sample | 11/11 (`data/eval/live-check.json`) |
| Live lookup time, 15 single requests (Node fetch from the author's machine, not a browser) | median 1.8 s, min 1.7 s, max 2.2 s, 15/15 found (`scripts/live_latency.mjs`, `docs/LIVE_LATENCY.json`) |
| Extraction on 10 held-out phrasings | serial 8/8, quantity 8/9 (miss: "12.5k tonnes") |
| Real publisher documents (hand-labelled) | 24 retirement sentences from 6 publishers (Dolomiti Energia, Storebrand, Commerzbank, easyJet, AIXTRON, Southampton Airport); `data/real/` |
| Extractor on those real sentences (`npm run eval:real`) | serial 18/18, quantity 18/18 after fixes; before fixes (the extractor as built in round 1): serial 8/18, quantity 1/18 |
| Held-out set (6 sentences, collected after the extractor was frozen) | first run serial 3/6 (PDF line-break artefact "PE -14"), quantity 6/6; after the fix 6/6. In-sample after fixing, so treat the 100% as a regression guard, not an estimate |
| Wording check on 72 frozen pairs (browser, [docs/NARRATIVE_EVAL.md](docs/NARRATIVE_EVAL.md)) | false May conflict on matching wording 2.8% (1/36), Backed on matching wording 80.6% (29/36), median 95 ms per sentence. Weakness: of 36 changed sentences only 27.8% (10/36) were flagged May conflict, the rest ended as No receipt, none as Backed |
| Do real reports print a serial? ([docs/SERIAL_PREVALENCE.md](docs/SERIAL_PREVALENCE.md)) | 0 of 10 public sustainability/annual reports contain a credit serial; such sentences still return No serial from the serial check |
| Sentence without a serial, first-time real sentences ([docs/BENEFICIARY_EVAL.md](docs/BENEFICIARY_EVAL.md)) | 3 of 10 reports contain a retirement sentence with a quantity; 2 of 10 reports get at least one registry candidate for their sentence; 0 of 10 have a candidate total equal to the sentence (registry total lower every time: Gold Standard only, other registries not looked up). 7 of 10 reports are from a company with retired Gold Standard blocks under its own name. Same 10 reports as the serial measurement (in-sample for that question, first-time sentences for this path) |
| One flow, one set of credits, Sepolia ([docs/flow-testnet.json](docs/flow-testnet.json)) | sentence without serial -> 2 Gold Standard candidates, total 131,201 t = the sentence -> both ranges registered (2 real transactions) -> second claim on the same range reverted with `RangeOverlap` (real transaction) |
| Domain tests | 107 pass (`npm run test:domain`) |
| Contract tests | 31 pass (`npm run test:contract`) |
| Gas for one registration | about 162k first on the local test chain, about 223k at the 40th range of one batch; 683,777 on Sepolia for the same call because Sepolia charges about 5 times more per new storage slot (measured, see below) |

## Testnet status
Deployed on Sepolia (chain id 11155111), 2026-10-21, with free test ETH (no real funds).

| Item | Value |
|---|---|
| RetirementRegistry | [`0xbBC97a57c7f81F77dbA1b1b2FbC29898b87F7bDF`](https://sepolia.etherscan.io/address/0xbBC97a57c7f81F77dbA1b1b2FbC29898b87F7bDF) ([Blockscout](https://eth-sepolia.blockscout.com/address/0xbBC97a57c7f81F77dbA1b1b2FbC29898b87F7bDF)) |
| Deploy tx (block 11957626, 3,994,914 gas) | [`0xa743104c...f1c0b5`](https://sepolia.etherscan.io/tx/0xa743104cf05e231bae450af14cc21d2524619363005a9a0b195f9d2819f1c0b5) |
| Register tx: one real Commerzbank retirement range 916907312-916910855 (block 11957628, 683,837 gas) | [`0x07eb32c4...127c59`](https://sepolia.etherscan.io/tx/0x07eb32c400eac99d4af7183317fe0305658d0f7f563f27e60388025c9b127c59) |
| Second claimant on the same credits: a real transaction (block 11958923, 25,496 gas, status Failed) | [`0x43ab85cf...b3db8b`](https://sepolia.etherscan.io/tx/0x43ab85cf22d4f85514a8ed25e015d137a4efdeb6671e138cd1a192e380b3db8b) ([Blockscout, revert decoded](https://eth-sepolia.blockscout.com/tx/0x43ab85cf22d4f85514a8ed25e015d137a4efdeb6671e138cd1a192e380b3db8b)): reverted with `RangeOverlap(batchKey, 916907312, 916910855)`; the range count stayed 1. Sent with a fixed gas limit so the failure is mined; contract source verified on Blockscout |

**One flow with the same credits** (2026-10-21, `scripts/flow_testnet.cjs`, record `docs/flow-testnet.json`). The sentence "In 2024 Google retired 131,201 tCO2e of Gold Standard credits through Cool Effect." is written by us from two public Gold Standard records whose beneficiary is "Google LLC" (Google did not publish it). The page finds both records by beneficiary, the total equals the sentence, and:

| Step | Serial range | Transaction |
|---|---|---|
| Register candidate 1 (61,544 credits, block 11959276, 683,777 gas) | `GS1-1-MU-GS12147-21-2022-27150-1257-62800` (1257-62800) | [`0xec12e785...1cd1eb`](https://eth-sepolia.blockscout.com/tx/0xec12e7852eaf117c14594119ec54553faeba119bbb4006bda5a68c5c254cd1eb) |
| Register candidate 2 (69,657 credits, block 11959277, 683,777 gas) | `GS1-1-MU-GS12147-21-2021-27149-1-69657` (1-69657) | [`0xbc7cdcc9...e2be8b`](https://eth-sepolia.blockscout.com/tx/0xbc7cdcc9aecebe640dbddfa3c1a396daa747d8796d4e6b396309f7a523be2e8b) |
| Second claimant, same range as candidate 1 (block 11959278, 25,496 gas, status Failed) | 1257-62800 | [`0x3567dcd9...259118`](https://eth-sepolia.blockscout.com/tx/0x3567dcd9d2407764415eba66acda8cc30ea6b5540f9fa44544756f1819259118): `RangeOverlap(batchKey, 1257, 62800)`, range count stayed 1 |

On the demo page, the same serial shows the Sepolia registration next to its Match result, and a Company B claim on it gets Double use from a read of the Sepolia contract (`conflictsWith`, `rangeCount`, `rangeAt` through a free public RPC, no wallet, no page memory): the result line says which contract was read, the stored claim hash and the overlap in credits. The page's own memory is only a fallback when the chain box is unticked. Real read captured in [docs/chain-read-sepolia.json](docs/chain-read-sepolia.json).

**Who registers on the contract, and why?** The registrant is the party that checks reports for others: an assurance provider or auditor who verifies a report's offset sentence against the public record and then writes the range to the registry. Its reason is liability: it signs "these credits back claim X" and wants the public record to show that nobody else was told the same. A reporting company cannot register anything itself (the contract admits attestors only). Limit, stated plainly: in this prototype the attestor set is one address, the deployer; nobody else has registered, so the chain answers only for the ranges in our own flows. Designed but not built: owner moved to a 2-of-3 multisig of independent assurance providers, and `register` requiring two attestor signatures; that changes the contract and its Sepolia address and has no test yet (not in SPEC G/W/T).

**Why 162k in the tests and 684k on Sepolia? Measured: the chain charges more per new storage slot, our code is not different.** ([docs/gas-diagnosis.json](docs/gas-diagnosis.json), `npx hardhat run scripts/gas_diagnosis.cjs`.) (1) The deployed bytecode on Sepolia is byte-for-byte the bytecode we compile locally (2,376 bytes, compiler 0.8.24, optimizer 200 runs). (2) We replayed the exact calldata of Sepolia transaction `0xec12e785...` on the local test chain: 161,857 gas against 683,777 on Sepolia. (3) A transaction trace of the real Sepolia transaction (free RPC with `debug_traceTransaction`) shows the same 6 `SSTORE` instructions on 6 new slots as the local trace; each one was charged 108,020 or 110,020 gas on Sepolia and 20,000 or 22,100 locally. (4) A 6-byte probe contract that only writes new slots costs about 111,259 gas per new slot on Sepolia and 22,106 locally, a ratio of 5.03, so no code of ours is involved. (5) The same probe, asked read-only of Ethereum mainnet (nothing sent), costs 22,320 per new slot, the same as the local chain; Sepolia's latest block header carries the fields `blockAccessListHash` and `slotNumber`, mainnet's does not. So Sepolia is running a newer gas schedule for creating storage than our local test chain and today's mainnet. We did not read the client source, so we do not name the exact rule. What follows for cost: the 162k figure is what the code costs under today's mainnet rule; if mainnet adopts Sepolia's schedule, one registration would cost about four times more.

Full record: `docs/testnet.json`. Overlap transaction: `IEEE_TESTNET_KEY_FILE=<keyfile> npx hardhat run --network testnet scripts/send_overlap_testnet.cjs`. Deploy: `IEEE_TESTNET_KEY_FILE=<keyfile> npx hardhat run --network testnet scripts/deploy_testnet.cjs`. The key never lives in the repo.

Cost in USD per operation and the zero-cost parts: [docs/COST.md](docs/COST.md).

## How it works
0. **No serial in the sentence:** `domain/beneficiary` reads company, year and quantity; `goldStandardLive.findByEntity` asks the registry (free-text `query`, paged by the `X-Total-Count` header) for blocks; a block is a candidate when it is RETIRED and the claimant is the leading words of its beneficiary name (`retirement_using_entity.name` or a note such as "on behalf of X"; legal suffixes ignored, so "Shenzhen Apple Brother" is not Apple). The result is the list of candidates, their total, and whether the total equals the sentence. It is a lead, never a verdict.
1. `domain/` parses serials (Gold Standard, Verra format) and quantities ("33,131 tCO2e", "2.5 ktCO2e", "1.2 million tonnes", "4 000 t").
2. `judge` compares the claim with the registry record: Match, Mismatch (not retired, quantity differs), Not found, Double use, No serial.
3. `RetirementRegistry.sol` stores serial ranges per batch. Registering a range that overlaps an earlier one reverts with `RangeOverlap`. Only attestors can register.
4. The demo page runs the same domain code as the tests in the browser.

```
domain/        pure functions: serial, claim, ledger, reconcile, beneficiary (no I/O)
application/  checkClaim, checkBeneficiary use cases + ports            
adapters/      sampleRecords (stored sample), goldStandardLive (HTTP)
contracts/     RetirementRegistry.sol, tested with Hardhat (local chain), deployed on Sepolia
docs/          static demo page, THREAT_MODEL.md
```

## Run it
```
npm install
npm test                # 107 domain + 31 contract tests
npm run eval:real       # extractor accuracy on real certificates -> data/eval/real-results.json
node scripts/eval_beneficiary.mjs [--offline]   # sentence-without-serial path on 10 real reports -> docs/BENEFICIARY_EVAL.md
IEEE_TESTNET_KEY_FILE=<keyfile> npx hardhat run --network testnet scripts/flow_testnet.cjs   # the one-flow Sepolia run
npm run eval            # regenerate data/eval/results.json
npm run chain-demo      # real run on a local chain -> docs/chain-transcript.json
npm run build:site      # copy code and data into docs/
```
Tests and evals need no RPC URL, no key and no paid service. Only the optional `--network testnet` scripts use a free public Sepolia RPC and your own test key (never in the repo). No paid RPC, no mainnet.

## Procedure and cost for an ESG reviewer
Input: the offset sentence from the report. Result: one verdict with the registry URL and fetch time, plus one line for the report: "Retirement of <n> t verified against <registry> record <serial>, <date>". Cost per claim: one free read request to the registry, and, if the claim is recorded on chain, one transaction of about 162k gas (first range of a batch) to about 223k gas (40th range of the same batch). Fee in USD = gas x gas price x token price of the chosen network, so it depends on the network; the contract has no fee of its own.

## Real documents behind the extractor numbers
24 sentences from certificates that six organisations post on their own sustainability or investor pages (the documents are retirement certificates, not whole sustainability reports): Dolomiti Energia (46 certificates in one PDF, 11 used), Storebrand (3), Commerzbank (1), easyJet (1 + a 6-page Madre de Dios file used as the held-out set), AIXTRON (1), Southampton Airport (1, Gold Standard). Source URLs are in `data/real/samples.json` and `heldout.json`. Truth (serial, quantity) was read by hand and cross-checked: for every labelled serial the range size equals the stated quantity. 6 of the 18 main sentences are text typed from a rendered PDF because the PDF hides its values from text extraction; the rest are the PDF text layer. The extractor is deterministic rules, not a language model.

## Where the data comes from
- Gold Standard registry, public read endpoint `https://public-api.goldstandard.org/credits` (the endpoint the registry's own web app uses; it answers CORS `*`). The sample is 7 requests of 20 rows, 5 s apart. Live lookup sends one request per serial.
- The registry's website terms forbid "spider, crawl, or scrape". We therefore keep to single read requests, store only serial facts (serial, status, quantity, project name) with source URL and date, and do not mirror the registry.
- Live lookup note: the registry sits behind bot protection. A plain script request (curl default agent) got HTTP 403 and a browser agent got 200 when we measured on 2026-10-21; some networks may block live lookup, so the stored sample is the default and live lookup is opt-in.
- Verra: measured 2026-10-21, five scripted requests (GET and POST, two `uiapi` search paths, one API host) to registry.verra.org all returned the HTML shell of its single-page application (HTTP 200, text/html, 2,598 bytes), never JSON, so there is no free scriptable endpoint we can use; Verra serials are parsed but not looked up (`registry_not_supported`). A browser-automation reader would be a different, fragile design and is not built.

## Limits
- Only Gold Standard is looked up. Verra is parsed only.
- Extraction and the verdict are rules, not a model (the optional wording check is the only model). Extraction misses unusual wordings (see held-out miss). A claim without a serial gets candidates, not a verdict: the registry only names a beneficiary for some blocks, other registries are not looked up, and the candidate total is compared with the sentence as written.
- A sub-range of a retired block that is not itself a registry row returns Not found unless the ledger already holds an overlapping range.
- Match means "the public record agrees with the sentence". It is not an audit and says nothing about project quality or who owns the credits.
- Evaluation claims are templated from real rows, not taken from real reports.
- Tests run on a local chain; the contract is also deployed on the Sepolia testnet (test ETH only, no real funds). Trust sits in the attestor set (single owner here). See `docs/THREAT_MODEL.md`.
- Real reports rarely print the serial: 0 of 10 reports we scanned did (`docs/SERIAL_PREVALENCE.md`). The serial check still returns No serial for them; the beneficiary path then gives candidates (3 of 10 reports had a retirement sentence with a quantity, 2 of 10 got a candidate, 0 of 10 matched the quantity: `docs/BENEFICIARY_EVAL.md`).
- The Sepolia flow uses a sentence we wrote from the public record, not a sentence a company published.
- The wording check is a small pre-trained model: it catches a changed fact only 27.8% of the time as May conflict and never says a claim is false.
- No personal data is collected. No model is trained by us. Company names in the beneficiary path come from the registry's public records.

## AI use
Code, tests and this document were drafted with Anthropic's Claude (Claude Code) and then run, measured and edited by the author. The claim parser, the beneficiary lookup and the verdict are deterministic rules. The only model in the product is the optional wording check: a pre-trained NLI model (Xenova/nli-deberta-v3-xsmall) running in the viewer's browser for inference, after a click, off the verdict path.

## License
MIT
