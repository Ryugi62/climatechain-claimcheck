# Threat model (one page)

Scope: the claim check and the registry contract. Out of scope: quality of the underlying carbon project.

| # | Attacker | Attack | Control | What remains |
|---|---|---|---|---|
| T1 | Report author | Cites a retirement that never happened (made-up or issued-only serial) | Domain check against the public record: unknown serial gives `NOT_FOUND`, issued-but-not-retired gives `MISMATCH not_retired`. Tests: `G2 MISMATCH not_retired`, `G4 NOT_FOUND`; experiment: 20/20 issued and 40/40 unknown caught | `NOT_FOUND` means "not in the records we hold". A real record from a registry we do not read (Verra) is not verified |
| T2 | Two companies | Back two claims with the same credits (double counting) | Contract refuses any overlapping range in the same batch (`RangeOverlap`). Tests: `exact repeat`, `left edge`, `right edge`, `contained`, `containing`, `second attestor` | Double use across two different registries, or with a differently written serial for the same credits, is not caught |
| T3 | Dishonest attestor | Registers a range that was never retired, or blocks a competitor by registering their range first | Every entry stores `evidenceHash` of the registry record and the attestor address, so anyone can re-fetch the record and compare; owner can remove an attestor. Tests: `stores range, claim hash and evidence hash`, `owner can remove an attestor` | Trust sits in the attestor set (single owner in this prototype). Production needs a multi-party attestor set |
| T4 | Document forger | Edits the quantity or serial in a PDF | Quantity is compared with the registry range (`quantity_differs`); experiment: 120/120 inflated quantities caught | A forged document that quotes a true serial and a true quantity for credits it does not own is not detected; ownership is not public |
| T5 | Registry data poisoning | Registry endpoint answers wrongly or is unreachable | Result lines show source URL and fetch time; unreachable source gives `NOT_FOUND source_error`, never `MATCH`. Test: `a failing record source becomes an error result` | We trust the registry's own public endpoint as ground truth |

Trust anchor: the registry record comes from the registry operator's domain (goldstandard.org), a different owner than this repository. The page prints the URL it used.
