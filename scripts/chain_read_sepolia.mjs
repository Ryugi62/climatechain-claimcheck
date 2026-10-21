// One real read of the deployed contract through the page's own code (eth_call only, nothing is sent).
// Company B checks the first Google serial range of docs/flow-testnet.json; Google checks it too. Output: docs/chain-read-sepolia.json
import fs from 'node:fs';
import { checkClaim } from '../src/application/checkClaim.mjs';
import { Ledger } from '../src/domain/ledger.mjs';
import { sepoliaRegistry } from '../src/adapters/sepoliaRegistry.mjs';
import { claimHashOf } from '../src/domain/chainAbi.mjs';

const flow = JSON.parse(fs.readFileSync('docs/flow-testnet.json', 'utf8'));
const first = flow.registered[0];
const rpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';
const chain = sepoliaRegistry({ rpcUrl, address: flow.contract });
const knownClaims = [{ claimant: flow.claimant, claimHash: claimHashOf(flow.claimant, flow.sentence) }];
const records = { find: async (s) => (s.raw === first.serial ? { serial_number: first.serial, status: 'RETIRED', number_of_credits: first.credits } : null) };
const text = `In 2022 we retired ${first.credits.toLocaleString('en-US')} tCO2e (serial ${first.serial}).`;
const out = { readAt: new Date().toISOString(), rpcUrl, contract: flow.contract, serial: first.serial, sentence: text, claims: {} };
for (const who of ['Company B', flow.claimant]) {
  const r = await checkClaim({ text, claimant: who }, { records, ledger: new Ledger(), chain, knownClaims });
  out.claims[who] = { verdict: r.verdict, source: r.lines[0].source || null, firstClaimant: r.lines[0].firstClaimant || null, overlap: r.lines[0].overlap || null, chainClaimHash: r.lines[0].chainClaimHash || null, chainError: r.chainError || null };
}
// the real company-written sentence (arm B), registered on chain by scripts/register_real_testnet.cjs
const real = JSON.parse(fs.readFileSync('docs/real-sentence-testnet.json', 'utf8'));
const rtext = `In 2022 ${real.claimant} retired ${real.credits.toLocaleString('en-US')} tCO2e (serial ${real.serial}).`;
const rrecords = { find: async (x) => (x.raw === real.serial ? { serial_number: real.serial, status: 'RETIRED', number_of_credits: real.credits } : null) };
const rknown = [...knownClaims, { claimant: real.claimant, claimHash: claimHashOf(real.claimant, real.sentence) }];
out.real = { serial: real.serial, registrationTx: real.tx.hash, claims: {} };
for (const who of ['Company B', real.claimant]) {
  const r = await checkClaim({ text: rtext, claimant: who }, { records: rrecords, ledger: new Ledger(), chain, knownClaims: rknown });
  out.real.claims[who] = { verdict: r.verdict, source: r.lines[0].source || null, firstClaimant: r.lines[0].firstClaimant || null, overlap: r.lines[0].overlap || null, chainClaimHash: r.lines[0].chainClaimHash || null, chainError: r.chainError || null };
}
fs.writeFileSync('docs/chain-read-sepolia.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
