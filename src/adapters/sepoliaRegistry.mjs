// Chain port: asks the deployed RetirementRegistry (eth_call only, no wallet, no transaction) which registered ranges overlap a serial range.
import { encodeConflictsWith, encodeRangeCount, encodeRangeAt, decodeBool, decodeUint, decodeRange } from '../domain/chainAbi.mjs';

export function sepoliaRegistry({ rpcUrl, address, fetchImpl = globalThis.fetch }) {
  let id = 0;
  async function call(data) {
    const res = await fetchImpl(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'eth_call', params: [{ to: address, data }, 'latest'] }) });
    if (!res.ok) throw new Error(`chain RPC HTTP ${res.status}`);
    const j = await res.json();
    if (j.error) throw new Error(`chain RPC: ${j.error.message || JSON.stringify(j.error)}`);
    return j.result;
  }
  return {
    async overlaps(range) {
      if (!decodeBool(await call(encodeConflictsWith(range.batchKey, range.start, range.end)))) return [];
      const n = decodeUint(await call(encodeRangeCount(range.batchKey)));
      const rows = [];
      for (let i = 0; i < n; i++) {
        const r = decodeRange(await call(encodeRangeAt(range.batchKey, i)));
        if (range.start <= r.end && range.end >= r.start) rows.push(r);
      }
      return rows;
    },
  };
}
