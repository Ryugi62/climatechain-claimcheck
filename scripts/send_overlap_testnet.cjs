// Send a REAL second registration that overlaps the already registered range on Sepolia, so the revert is mined
// and visible in the block explorer. Calls the existing `register`; no contract change.
// A fixed gasLimit skips ethers' gas estimation (which would fail with the revert before sending).
// Run: IEEE_TESTNET_KEY_FILE=<keyfile> npx hardhat run --network testnet scripts/send_overlap_testnet.cjs
const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');
const T = path.join(__dirname, '..', 'docs', 'testnet.json');

async function main() {
  if (network.name === 'hardhat') throw new Error('run with --network testnet');
  const j = JSON.parse(fs.readFileSync(T, 'utf8'));
  const [signer] = await ethers.getSigners();
  const reg = await ethers.getContractAt('RetirementRegistry', j.address, signer);
  const batchKey = ethers.id('VERRA:4679:2023:18974');
  const [a, b] = j.range.map(BigInt);
  const start = a + 100n, end = b - 100n; // inside the registered range
  const claimHash = ethers.id('claim:second claimant (demo)');
  const evidenceHash = ethers.id(`evidence:verra-retirement-certificate:${j.serial}`);
  console.log('conflictsWith before:', await reg.conflictsWith(batchKey, start, end), 'rangeCount:', (await reg.rangeCount(batchKey)).toString());
  const tx = await reg.register(batchKey, start, end, claimHash, evidenceHash, { gasLimit: 300000n });
  console.log('sent', tx.hash);
  let rc;
  try { rc = await tx.wait(); } catch (e) { rc = e.receipt; if (!rc) throw e; }
  console.log('status', rc.status, 'block', rc.blockNumber, 'gasUsed', rc.gasUsed.toString());
  // revert reason by replaying the call at the block before
  let reason = null, args = [];
  try { await ethers.provider.call({ from: signer.address, to: j.address, data: tx.data }, rc.blockNumber - 1); }
  catch (e) { const d = e.data; const err = d && reg.interface.parseError(d); reason = err ? err.name : String(e.shortMessage || e.message); args = err ? err.args.map(String) : []; }
  console.log('revert reason', reason, args);
  console.log('rangeCount after:', (await reg.rangeCount(batchKey)).toString());
  j.overlapTx = { hash: rc.hash, status: rc.status, block: rc.blockNumber, gasUsed: Number(rc.gasUsed), range: [start.toString(), end.toString()], revert: reason, args };
  if (rc.status === 0) fs.writeFileSync(T, JSON.stringify(j, null, 2) + '\n');
}
main().catch((e) => { console.error(e); process.exit(1); });
