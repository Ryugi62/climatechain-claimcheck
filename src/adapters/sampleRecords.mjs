// RecordSource backed by a stored sample (array of registry rows).
export function sampleRecords(rows) {
  const by = new Map(rows.map((r) => [r.serial_number, r]));
  return { find: async (s) => by.get(s.raw) || null, size: by.size };
}
