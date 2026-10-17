// RecordSource that asks the Gold Standard public read endpoint for one serial (one request per serial).
// Works in Node and in a browser (the endpoint answers CORS: *). Returns null when the registry has no such serial.
const BASE = 'https://public-api.goldstandard.org/credits';

export function goldStandardLive(fetchImpl = globalThis.fetch) {
  return {
    async find(s) {
      if (s.registry !== 'GOLD_STANDARD') return null;
      const url = `${BASE}?size=2&query=${encodeURIComponent(s.raw)}`;
      const res = await fetchImpl(url);
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
