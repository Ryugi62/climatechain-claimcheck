// Serial parsing. Pure functions, no I/O.
const DASHES = /[‐‑‒–—−]/g;

const GS_RE = /\bGS1-\d+-([A-Z]{2})-(GS\d+)-\d+-(\d{4})-(\d+)-(\d+)-(\d+)\b/i;
const VCU_RE = /\b(\d+)-(\d+)-(\d+)-(?:[A-Z]{2,4}-)?VCU-\d+-[A-Z]+-[A-Z]{2,3}-\d+-(\d+)-(\d{2})(\d{2})(\d{4})-(\d{2})(\d{2})(\d{4})-\d+\b/i;

// PDF text extraction can leave a space before a dash at a line break ("PE -14"): close it inside identifiers.
const normalise = (s) => String(s).replace(DASHES, '-').toUpperCase().replace(/([A-Z0-9])[ \t]+-(?=\d)/g, '$1-');

function build(registry, project, vintage, batch, start, end, raw, country) {
  if (!(end >= start)) return null;
  return {
    registry, project, country, vintage, batch, start, end,
    quantity: end - start + 1,
    batchKey: `${registry}:${project}:${vintage}:${batch}`,
    raw,
  };
}

export function parseSerial(input) {
  if (typeof input !== 'string' || !input) return null;
  const t = normalise(input.trim());
  let m = new RegExp(`^${GS_RE.source}$`, 'i').exec(t);
  if (m) return build('GOLD_STANDARD', m[2], Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), m[0], m[1]);
  m = new RegExp(`^${VCU_RE.source}$`, 'i').exec(t);
  if (m) return build('VERRA', m[4], Number(m[10]), Number(m[1]), Number(m[2]), Number(m[3]), m[0], null);
  return null;
}

export function findSerials(text) {
  if (typeof text !== 'string') return [];
  const t = normalise(text);
  const hits = [];
  for (const re of [GS_RE, VCU_RE]) {
    const g = new RegExp(re.source, 'gi');
    let m;
    while ((m = g.exec(t))) hits.push({ at: m.index, raw: m[0] });
  }
  hits.sort((a, b) => a.at - b.at);
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    if (seen.has(h.raw)) continue;
    seen.add(h.raw);
    const s = parseSerial(h.raw);
    if (s) out.push(s);
  }
  return out;
}

export function stripSerials(text) {
  let t = normalise(text);
  for (const re of [GS_RE, VCU_RE]) t = t.replace(new RegExp(re.source, 'gi'), ' ');
  return t;
}

/** Like stripSerials but keeps the original letter case (for text shown to a language model). */
export function maskSerials(text) {
  let t = String(text).replace(DASHES, '-').replace(/([A-Za-z0-9])[ \t]+-(?=\d)/g, '$1-');
  for (const re of [GS_RE, VCU_RE]) t = t.replace(new RegExp(re.source, 'gi'), ' ');
  return t;
}
