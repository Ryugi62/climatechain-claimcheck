// One flow with one set of credits (SPEC G21): sentence without serial -> Gold Standard candidates (live, by beneficiary)
// -> register the candidate ranges on the registry -> a second claimant on the SAME range is refused (RangeOverlap, mined).
// Writes docs/flow-testnet.json. Without --network it runs on the in-process chain (dry run, nothing written).
// Run: IEEE_TESTNET_KEY_FILE=<keyfile> npx hardhat run --network testnet scripts/flow_testnet.cjs
const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');

const SENTENCE = 'In 2024 Google retired 131,201 tCO2e of Gold Standard credits through Cool Effect.';
const CLAIMANT = 'Google';
const UA = { 'User-Agent': 'Mozilla/5.0 (claimcheck research sample)' };

async function main() {
  const { checkBeneficiary } = await import('../src/application/checkBeneficiary.mjs');
  const { goldStandardLive } = await import('../src/adapters/goldStandardLive.mjs');
  const { parseSerial } = await import('../src/domain/serial.mjs');
  const check = await checkBeneficiary({ text: SENTENCE, claimant: CLAIMANT }, { registry: goldStandardLive(fetch, { headers: UA }) });
  console.log('beneficiary check:', check.status, 'candidates', check.candidates.length, 'total', check.total, 'claimed', check.claimed);
  if (check.status !== 'MATCH') throw new Error('expected MATCH, got ' + check.status);

  const [signer] = await ethers.getSigners();
  const live = network.name !== 'hardhat';
  let reg, address;
  if (live) {
    address = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'testnet.json'), 'utf8')).address;
    reg = await ethers.getContractAt('RetirementRegistry', address, signer);
  } else {
    reg = await (await ethers.getContractFactory('RetirementRegistry')).deploy();
    await reg.waitForDeployment(); address = await reg.getAddress();
    await (await reg.addAttestor(signer.address)).wait();
  }
  const rec = (rc) => ({ hash: rc.hash, status: rc.status, gasUsed: Number(rc.gasUsed), block: rc.blockNumber, effectiveGasPriceWei: rc.gasPrice?.toString() ?? null });
  const registered = [];
  for (const c of check.candidates) {
    const s = parseSerial(c.serial_number);
    const batchKey = ethers.id(s.batchKey);
    if (await reg.conflictsWith(batchKey, s.start, s.end)) { console.log('already registered:', c.serial_number); registered.push({ serial: c.serial_number, batchKey: s.batchKey, range: [s.start, s.end], credits: c.number_of_credits, alreadyRegistered: true }); continue; }
    const claimHash = ethers.id(`claim:${CLAIMANT}:${SENTENCE}`);
    const evidenceHash = ethers.id(`evidence:gold-standard-record:${c.serial_number}`);
    const rc = await (await reg.register(batchKey, s.start, s.end, claimHash, evidenceHash)).wait();
    console.log('registered', c.serial_number, rc.hash, 'gas', rc.gasUsed.toString());
    registered.push({ serial: c.serial_number, batchKey: s.batchKey, range: [s.start, s.end], credits: c.number_of_credits, tx: rec(rc) });
  }
  // second claimant on the first candidate's exact range: sent for real with a fixed gas limit so the revert is mined
  const first = registered[0];
  const bk = ethers.id(first.batchKey);
  const second = ethers.id('claim:second claimant (demo)');
  let rc, reason = null, args = [];
  try {
    const tx = await reg.register(bk, first.range[0], first.range[1], second, ethers.id(`evidence:gold-standard-record:${first.serial}`), { gasLimit: 300000n });
    try { rc = await tx.wait(); } catch (e) { rc = e.receipt; if (!rc) throw e; }
    try { await ethers.provider.call({ from: signer.address, to: address, data: tx.data }, rc.blockNumber - 1); }
    catch (e) { const d = e.data; const err = d && reg.interface.parseError(d); reason = err ? err.name : String(e.shortMessage || e.message); args = err ? err.args.map(String) : []; }
  } catch (e) { // in-process chain refuses at submission (dry run only); a public chain mines the revert
    const err = e.data && reg.interface.parseError(e.data);
    if (live || !err) throw e;
    reason = err.name; args = err.args.map(String); rc = { hash: null, status: 0, gasUsed: 0n, blockNumber: null };
  }
  console.log('second claim: status', rc.status, 'revert', reason, 'tx', rc.hash);
  const out = {
    network: network.name, chainId: (await ethers.provider.getNetwork()).chainId.toString(), contract: address,
    sentence: SENTENCE, claimant: CLAIMANT, note: 'The sentence is written by us from the public Gold Standard records (beneficiary "Google LLC"); Google did not publish it.',
    check: { status: check.status, candidates: check.candidates.map((c) => ({ serial: c.serial_number, credits: c.number_of_credits, vintage: c.vintage, retired_on: c.retired_on, note: c.note, source_url: c.source_url })), total: check.total, claimed: check.claimed },
    registered, secondClaim: { claimant: 'second claimant (demo)', serial: first.serial, range: first.range, tx: rec(rc), revert: reason, args },
    rangeCount: (await reg.rangeCount(bk)).toString(),
  };
  if (live) { fs.writeFileSync(path.join(__dirname, '..', 'docs', 'flow-testnet.json'), JSON.stringify(out, null, 2) + '\n'); console.log('written docs/flow-testnet.json'); }
  else console.log(JSON.stringify(out.secondClaim));
}
main().catch((e) => { console.error(e); process.exit(1); });
