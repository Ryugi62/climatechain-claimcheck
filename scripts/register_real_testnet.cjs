// The real company-written sentence (United Internet FY2024, arm B of docs/REAL_SENTENCE_HUNT.md) -> its Gold Standard record -> one registration on the registry.
// Without --network it is a dry run on the in-process chain. Live: IEEE_TESTNET_KEY_FILE=<keyfile> npx hardhat run --network testnet scripts/register_real_testnet.cjs
// Writes docs/real-sentence-testnet.json (live only).
const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');
const SENTENCE = 'In fiscal year 2024, the Business Access Segment retired 4,713 Gold Standard-compliant verified emission reductions (VERs).';
const CLAIMANT = '1&1 Versatel';
const SOURCE = 'https://report.united-internet.de/sustainability/2024/environment/climate-change-mitigation-and-climate-change/ghg-removals-and-ghg-mitigation-projects-financed-through-carbon-credits.html';

async function main() {
  const { checkBeneficiary } = await import('../src/application/checkBeneficiary.mjs');
  const { goldStandardLive } = await import('../src/adapters/goldStandardLive.mjs');
  const { parseSerial } = await import('../src/domain/serial.mjs');
  const check = await checkBeneficiary({ text: SENTENCE, claimant: CLAIMANT }, { registry: goldStandardLive(fetch, { headers: { 'User-Agent': 'Mozilla/5.0 (claimcheck research sample)' } }) });
  if (check.status !== 'MATCH' || check.candidates.length !== 1) throw new Error('expected MATCH with one candidate, got ' + check.status);
  const c = check.candidates[0];
  const s = parseSerial(c.serial_number);
  const [signer] = await ethers.getSigners();
  const live = network.name !== 'hardhat';
  let reg;
  if (live) reg = await ethers.getContractAt('RetirementRegistry', JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'testnet.json'), 'utf8')).address, signer);
  else { reg = await (await ethers.getContractFactory('RetirementRegistry')).deploy(); await reg.waitForDeployment(); await (await reg.addAttestor(signer.address)).wait(); }
  const batchKey = ethers.id(s.batchKey);
  if (await reg.conflictsWith(batchKey, s.start, s.end)) { console.log('already registered', c.serial_number); return; }
  const claimHash = ethers.id(`claim:${CLAIMANT}:${SENTENCE}`);
  const rc = await (await reg.register(batchKey, s.start, s.end, claimHash, ethers.id(`evidence:gold-standard-record:${c.serial_number}`))).wait();
  console.log('registered', c.serial_number, 'gas', rc.gasUsed.toString(), 'tx', rc.hash);
  if (live) {
    const out = { network: 'testnet', chainId: '11155111', contract: await reg.getAddress(), source: SOURCE, sentence: SENTENCE, claimant: CLAIMANT, serial: c.serial_number, batchKey: s.batchKey, range: [s.start, s.end], credits: c.number_of_credits,
      tx: { hash: rc.hash, status: rc.status, gasUsed: Number(rc.gasUsed), block: rc.blockNumber } };
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'real-sentence-testnet.json'), JSON.stringify(out, null, 2) + '\n');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
