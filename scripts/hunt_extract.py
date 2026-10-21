"""Downloads each report of data/reports2/manifest.json (free public PDF or web page) and lists candidate retirement sentences
(retire/offset/credit/neutral near a tonne quantity) with page numbers. A human read of the hits decides which go into sentences.json.
usage: python3 scripts/hunt_extract.py [workdir]   (PDFs are not stored in the repo; text goes to workdir)"""
import json, os, re, subprocess, sys
import fitz
work = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hunt2'
os.makedirs(work, exist_ok=True)
man = json.load(open('data/reports2/manifest.json'))
Q = re.compile(r'(\d{1,3}(?:[,.  ]\d{3})+|\d+(?:\.\d+)?)\s*(million|m|k|thousand)?\s*(?:metric\s+)?(?:tonnes?|tons?|tCO2e?|t\s?CO2e?|MtCO2e?|ktCO2e?)', re.I)
K = re.compile(r'retire|offset|carbon credit|neutral|compensat|credits', re.I)
out = []
for m in man:
    path = os.path.join(work, m['id'] + '.bin')
    if not os.path.exists(path):
        subprocess.run(['curl', '-sL', '-m', '180', '-A', 'Mozilla/5.0 (claimcheck research; contact: ryugi62 on GitHub)', '-o', path, m['url']])
    row = {'id': m['id'], 'publisher': m['publisher'], 'url': m['url'], 'bytes': os.path.getsize(path) if os.path.exists(path) else 0, 'hits': []}
    try:
        raw = open(path, 'rb').read()
        if raw[:5] == b'%PDF-':
            doc = fitz.open(path)
            pages = [page.get_text() for page in doc]
        else:  # web page: strip tags, one pseudo-page per 6,000 characters
            html = raw.decode('utf-8', 'ignore')
            html = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', html)
            txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html))
            pages = [txt[i:i + 6000] for i in range(0, len(txt), 6000)]
        row['pages'] = len(pages)
        for pi, ptxt in enumerate(pages, 1):
            t = re.sub(r'\s+', ' ', ptxt)
            for s in re.split(r'(?<=[.;])\s+(?=[A-Z])', t):
                if Q.search(s) and re.search(r'retire|offset|carbon credit|credits', s, re.I) and len(s) < 600:
                    row['hits'].append({'page': pi, 'text': s.strip()})
    except Exception as e:
        row['error'] = str(e)[:120]
    out.append(row)
    print(m['id'], row.get('pages'), len(row['hits']), row.get('error', ''), flush=True)
json.dump(out, open('data/reports2/hits.json', 'w'), indent=1)
