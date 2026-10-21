# Do real sustainability reports print credit serials? (measured 2026-10-21)

Question (from review): ClaimCheck needs a serial in the sentence. Real reports may not print one. We measured it instead of assuming.

Method: 10 public PDFs (3 big-tech environmental reports, 2 easyJet documents, Commerzbank, Storebrand x2, AIXTRON, Netflix), text layer extracted with PyMuPDF, then the product's own `findSerials` run on the raw text and on the whitespace-flattened text (catches PDF line breaks). A loose pattern search (`digits-digits-digits`, `GS1-`, "serial number") was also run by hand. Re-run: `node scripts/serial_prevalence.mjs <dir with id.txt>`; list and per-report rows in `data/reports/manifest.json` and `data/reports/results.json`. PDFs are not stored in the repo.

| Publisher | Source | Characters | Offset/credit/retired words | Verra/Gold Standard words | Serials found |
|---|---|---|---|---|---|
| Microsoft | [PDF](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/msc/documents/presentations/CSR/Microsoft-2024-Environmental-Sustainability-Report.pdf) | 270,501 | 10 | 0 | 0 |
| Apple | [PDF](https://www.apple.com/environment/pdf/Apple_Environmental_Progress_Report_2024.pdf) | 361,531 | 38 | 7 | 0 |
| Google | [PDF](https://www.gstatic.com/gumdrop/sustainability/google-2024-environmental-report.pdf) | 360,678 | 5 | 1 | 0 |
| easyJet (annual report FY24, sustainability section) | [PDF](https://s203.q4cdn.com/522538739/files/doc_downloads/2024/12/easyJet_AR24_web.pdf) | 863,026 | 37 | 2 | 0 |
| easyJet (2022 sustainability extract of the annual report) | [PDF](https://www.easyjet.com/ejcms/cache/medialibrary/files/sustainability/easyjet_2022_ara_sustainability_221215.pdf) | 107,201 | 8 | 2 | 0 |
| Commerzbank (non-financial report 2023) | [PDF](https://www.commerzbank.de/ms/documents/en/non-financial-report-2023.pdf) | 462,649 | 2 | 0 | 0 |
| Storebrand (annual report 2023) | [PDF](https://www.storebrand.no/en/investor-relations/annual-reports/_/attachment/inline/356bc0b6-e4c5-496b-bb96-820365979d15:c7b2d6ec72e04cdc4c32afdc7de4198eebf3ccee/2023-annual-report-storbrand-asa.pdf) | 1,110,465 | 16 | 0 | 0 |
| Storebrand (carbon footprint report 2023) | [PDF](https://www.storebrand.no/en/sustainability/sustainability-library/_/attachment/inline/53a275c4-ed2f-4895-982b-960fe87e3b4b:809b5e4d5f5af6630610c37cec57c99c89046644/2023-Storebrand-carbon-footprint-report.pdf) | 13,828 | 0 | 0 | 0 |
| AIXTRON (sustainability report 2023) | [PDF](https://www.aixtron.com/investoren/publikationen/2023/en/Sustainability%20Report%202023.pdf) | 146,158 | 1 | 0 | 0 |
| Netflix (ESG report 2024) | [PDF](https://s22.q4cdn.com/959853165/files/doc_downloads/2025/6/2024-Netflix-Environmental-Social-Governance-Report.pdf) | 114,484 | 33 | 3 | 0 |

**Result: 0 of 10 reports print at least one credit serial.** Sample size 10, chosen by us (not random; mostly companies known to buy credits), so this is a finding about these reports, not a market estimate. Offsets are usually described as totals ("we retired X credits") and the proof sits in a separate certificate PDF (the 24 sentences in `data/real/` come from such certificates).

What this means for the product:
- Pasting a report sentence from these reports returns `No serial` (nothing to verify). That is the correct output: the claim cannot be checked from the report alone. It is the main limit of the idea, and it is also the value: a reader sees which claims come with no checkable identifier.
- ClaimCheck works where a serial is published: certificates and retirement pages that companies post next to their report.
- Not measured: whether those separate certificates are linked from the reports (we did not follow links).
