// Real run on the in-process Hardhat network; writes docs/chain-transcript.json for the demo page.
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [owner, attestor] = await ethers.getSigners();
  const reg = await (await ethers.getContractFactory('RetirementRegistry')).deploy();
  await reg.waitForDeployment();
  await (await reg.addAttestor(attestor.address)).wait();
  const batchKey = ethers.id('GOLD_STANDARD:GS7643:2025:31135');
  const steps = [];
  const attempt = async (label, claimant, start, end) => {
    const claimHash = ethers.id(`claim:${claimant}:${start}-${end}`);
    const evidenceHash = ethers.id('evidence:gs-record-610065');
    try {
      const rc = await (await reg.connect(attestor).register(batchKey, start, end, claimHash, evidenceHash)).wait();
      steps.push({ label, claimant, serialRange: [start, end], outcome: 'REGISTERED', gasUsed: Number(rc.gasUsed), block: rc.blockNumber });
    } catch (e) {
      const err = reg.interface.parseError(e.data || e.error?.data || '0x');
      steps.push({ label, claimant, serialRange: [start, end], outcome: 'REVERTED', error: err ? err.name : String(e.shortMessage || e.message), args: err ? err.args.map(String) : [] });
    }
  };
  await attempt('Company A registers its retirement', 'Company A', 1059, 34189);
  await attempt('Company B claims the same credits', 'Company B', 1059, 34189);
  await attempt('Company B claims a partly overlapping range', 'Company B', 30000, 40000);
  await attempt('Company B claims the next free range', 'Company B', 34190, 40000);
  const out = { network: 'hardhat (local, in-process)', contract: 'RetirementRegistry', batchKey: 'GOLD_STANDARD:GS7643:2025:31135', steps };
  fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'chain-transcript.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(steps, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
