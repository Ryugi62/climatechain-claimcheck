// RecordSource that asks the Gold Standard public read endpoint for one serial (one request per serial).
// Works in Node and in a browser (the endpoint answers CORS: *). Returns null when the registry has no such serial.
const BASE = 'https://public-api.goldstandard.org/credits';

const PAGE = 20;
const MAX_PAGES = 10; // at most 200 blocks per company: the page stays polite to a free public endpoint

export function goldStandardLive(fetchImpl = globalThis.fetch, { headers = {} } = {}) {
  return {
    /** Beneficiary search: the endpoint's free-text `query` also matches the retirement beneficiary and the note. */
    async findByEntity(name) {
      const rows = [];
      let total = Infinity;
      for (let page = 1; page <= MAX_PAGES && rows.length < total; page++) {
        const url = `${BASE}?size=${PAGE}&page=${page}&query=${encodeURIComponent(name)}`;
        const res = await fetchImpl(url, { headers });
        if (!res.ok) throw new Error(`registry answered HTTP ${res.status}`);
        const t = Number(res.headers && res.headers.get && res.headers.get('x-total-count'));
        if (Number.isFinite(t)) total = t;
        const part = await res.json();
        if (!part.length) break;
        const at = new Date().toISOString().slice(0, 16) + 'Z';
        for (const r of part) rows.push({ ...r, project_name: r.project && r.project.name, source_url: url, fetched_at: at, registry: 'GOLD_STANDARD' });
        if (part.length < PAGE) break;
      }
      return rows;
    },

    async find(s) {
      if (s.registry !== 'GOLD_STANDARD') return null;
      const url = `${BASE}?size=2&query=${encodeURIComponent(s.raw)}`;
      const res = await fetchImpl(url, { headers });
      if (!res.ok) throw new Error(`registry answered HTTP ${res.status}`);
      const rows = await res.json();
      const hit = rows.find((r) => String(r.serial_number).toUpperCase() === s.raw);
      if (!hit) return null;
      return {
        serial_number: hit.serial_number, status: hit.status, number_of_credits: hit.number_of_credits,
        vintage: hit.vintage, project_name: hit.project && hit.project.name,
        source_url: url, fetched_at: new Date().toISOString().slice(0, 16) + 'Z', registry: 'GOLD_STANDARD',
      };
    },
  };
}
