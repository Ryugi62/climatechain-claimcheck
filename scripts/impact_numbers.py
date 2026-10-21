#!/usr/bin/env python3
"""Real-sentence quantity tally (SPEC G30). Reads the two stored runs of the product's
beneficiary check on real report sentences and prints N, A, B, C. No network.
N = real retirement/offset sentences with a tonne quantity (a result with `claimed`).
A = sum of tonnes those sentences claim.
B = sum over sentences of min(claimed, registry total): tonnes covered by retired Gold Standard
    blocks named for the same company (and year when the sentence gives one). Upper bound for 'traceable'.
C = A - B: tonnes a reader cannot trace to a Gold Standard record today.
Arm B (United Internet, found by search, 4,713 t, exact) is reported apart and not in N.
"""
import json, os, statistics
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rows = []
for f in ('data/reports/beneficiary-results.json', 'data/reports2/results.json'):
    for r in json.load(open(os.path.join(root, f)))['rows']:
        for x in r.get('results', []):
            res = x['result']
            if res.get('claimed'):
                rows.append((r['id'], res['claimed'], res.get('total') or 0, res['status']))
N = len(rows)
A = sum(c for _, c, _, _ in rows)
B = sum(min(c, t) for _, c, t, _ in rows)
C = A - B
exact = sum(1 for _, c, t, _ in rows if c == t)
none = sum(1 for _, _, t, _ in rows if t == 0)
out = []
out.append('sentence | claimed t | Gold Standard registry total t | traced t (min)')
for i, c, t, s in rows:
    out.append(f'{i} | {c:,} | {t:,} | {min(c, t):,}')
out.append(f'N={N} real sentences with a quantity (2 samples: 10 + 30 public reports)')
out.append(f'A={A:,} tCO2e claimed')
out.append(f'B={B:,} tCO2e covered by retired Gold Standard blocks under the same company name')
out.append(f'C={C:,} tCO2e not traceable to Gold Standard today ({C / A:.1%})')
out.append(f'exact quantity matches={exact} of {N}; sentences with no Gold Standard block found={none}')
out.append(f'median claimed t={int(statistics.median(c for _, c, _, _ in rows)):,}; without the largest sentence: A={A - max(c for _, c, _, _ in rows):,}')
text = '\n'.join(out) + '\n'
print(text)
open(os.path.join(root, 'docs', 'IMPACT_NUMBERS.txt'), 'w').write(text)
