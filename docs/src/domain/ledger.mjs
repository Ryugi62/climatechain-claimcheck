// Domain mirror of the on-chain registry: ranges per batchKey, no overlap across claimants.
export class Ledger {
  constructor() { this.byBatch = new Map(); }

  size() { let n = 0; for (const v of this.byBatch.values()) n += v.length; return n; }

  conflicts(range, claimant) {
    const rows = this.byBatch.get(range.batchKey) || [];
    const out = [];
    for (const r of rows) {
      if (r.claimant === claimant) continue;
      const lo = Math.max(r.start, range.start);
      const hi = Math.min(r.end, range.end);
      if (lo <= hi) out.push({ claimant: r.claimant, start: lo, end: hi, overlap: hi - lo + 1 });
    }
    return out;
  }

  register(range, claimant) {
    const c = this.conflicts(range, claimant);
    if (c.length) return { ok: false, conflicts: c };
    const rows = this.byBatch.get(range.batchKey) || [];
    rows.push({ start: range.start, end: range.end, claimant });
    this.byBatch.set(range.batchKey, rows);
    return { ok: true, conflicts: [] };
  }
}
