#!/usr/bin/env python3
"""Fetch a SMALL sample of Gold Standard registry credit-block records.
One request per page (size<=20), 5 s apart. Not a crawler: <= 8 requests per run.
Source: public read endpoint used by https://registry.goldstandard.org (CORS: *).
"""
import json, sys, time, urllib.request, datetime
BASE = "https://public-api.goldstandard.org/credits"
PLAN = [("retired=true", p) for p in (1, 1500, 4000, 7000)] + [("", 1), ("", 3000), ("", 6000)]
KEEP = ["id", "serial_number", "status", "number_of_credits", "starting_credit_number", "ending_credit_number",
        "batch_number", "vintage", "certified_date", "retirement_use_case", "is_retirable"]
out = []
for q, page in PLAN:
    url = f"{BASE}?size=20&page={page}" + (f"&{q}" if q else "")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (claimcheck research sample)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.load(r)
    when = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ")
    for x in rows:
        rec = {k: x.get(k) for k in KEEP}
        rec["project_name"] = x["project"]["name"] if x.get("project") else None
        rec["country_code"] = x["project"].get("country_code") if x.get("project") else None
        rec["source_url"] = url
        rec["fetched_at"] = when
        rec["registry"] = "GOLD_STANDARD"
        out.append(rec)
    print(url, len(rows), file=sys.stderr)
    time.sleep(5)
json.dump(out, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print(len(out), "records")
