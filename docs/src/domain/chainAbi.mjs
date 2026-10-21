// Minimal ABI encoding for the read-only calls the page makes to RetirementRegistry. Pure functions.
import { keccak256Utf8 } from './keccak.mjs';

const selector = (sig) => keccak256Utf8(sig).slice(2, 10);
const word = (n) => BigInt(n).toString(16).padStart(64, '0');
const strip = (hex) => String(hex).replace(/^0x/, '');

export const batchKeyHash = (batchKey) => keccak256Utf8(batchKey);
export const claimHashOf = (claimant, sentence) => keccak256Utf8(`claim:${claimant}:${sentence}`);

export const encodeConflictsWith = (batchKey, start, end) => '0x' + selector('conflictsWith(bytes32,uint64,uint64)') + strip(batchKeyHash(batchKey)) + word(start) + word(end);
export const encodeRangeCount = (batchKey) => '0x' + selector('rangeCount(bytes32)') + strip(batchKeyHash(batchKey));
export const encodeRangeAt = (batchKey, i) => '0x' + selector('rangeAt(bytes32,uint256)') + strip(batchKeyHash(batchKey)) + word(i);

export const decodeUint = (hex) => Number(BigInt('0x' + strip(hex).slice(0, 64)));
export const decodeBool = (hex) => decodeUint(hex) === 1;
export function decodeRange(hex) {
  const h = strip(hex);
  const w = (i) => h.slice(i * 64, (i + 1) * 64);
  return { start: Number(BigInt('0x' + w(0))), end: Number(BigInt('0x' + w(1))), claimHash: '0x' + w(2), evidenceHash: '0x' + w(3), attestor: '0x' + w(4).slice(24) };
}
