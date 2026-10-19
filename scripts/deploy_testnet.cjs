// Deploy RetirementRegistry, register one REAL retirement (Verra certificate published by Commerzbank),
// then show a second claimant on the same credits being refused. Writes docs/testnet.json.
// Run: IEEE_TESTNET_KEY_FILE=/path/to/keyfile npx hardhat run --network testnet scripts/deploy_testnet.cjs
// Without --network it runs on the in-process chain (dry run).
const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');

const CERT = '18974-916907312-916910855-VCS-VCU-262-VER-IN-13-4679-16102023-31122023-0'; // data/real/samples.json commerzbank-2025
const [, a, b] = CERT.split('-');

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log('network', network.name, 'chainId', net.chainId.toString(), 'deployer', deployer.address, 'balance', ethers.formatEther(bal));
  const factory = await ethers.getContractFactory('RetirementRegistry');
  const reg = await factory.deploy();
  const depRc = await reg.deploymentTransaction().wait();
  const address = await reg.getAddress();
  const rec = (rc) => ({ hash: rc.hash, gasUsed: Number(rc.gasUsed), effectiveGasPriceWei: rc.gasPrice?.toString() ?? null, block: rc.blockNumber });
  const addRc = await (await reg.addAttestor(deployer.address)).wait();
  const batchKey = ethers.id('VERRA:4679:2023:18974');
  const start = BigInt(a), end = BigInt(b);
  const claimHash = ethers.id(`claim:Commerzbank AG:${CERT}`);
  const evidenceHash = ethers.id(`evidence:verra-retirement-certificate:${CERT}`);
  const regRc = await (await reg.register(batchKey, start, end, claimHash, evidenceHash)).wait();
  let refused;
  try {
    await reg.register.staticCall(batchKey, start + 100n, end - 100n, ethers.id('claim:second claimant'), evidenceHash);
    refused = { refused: false };
  } catch (e) {
    const err = reg.interface.parseError(e.data || e.error?.data || '0x');
    refused = { refused: true, error: err ? err.name : String(e.shortMessage || e.message), args: err ? err.args.map(String) : [] };
  }
  const out = {
    network: network.name, chainId: net.chainId.toString(), contract: 'RetirementRegistry', address,
    deployer: deployer.address, batchKey: 'VERRA:4679:2023:18974', serial: CERT, range: [a, b],
    deployTx: rec(depRc), addAttestorTx: rec(addRc), registerTx: rec(regRc), secondClaimant: refused,
    note: 'Registered range is the retirement stated on a Verra certificate that Commerzbank AG publishes (data/real/samples.json).',
  };
  if (network.name !== 'hardhat') fs.writeFileSync(path.join(__dirname, '..', 'docs', 'testnet.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
