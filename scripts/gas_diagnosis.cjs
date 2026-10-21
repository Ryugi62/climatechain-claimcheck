// Why does the same register() call cost ~162k on the local test chain and ~684k on Sepolia?
// Measures instead of guessing. Run: npx hardhat run scripts/gas_diagnosis.cjs   (reads free public RPCs only; sends nothing)
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

const SEPOLIA_TX = '0xec12e7852eaf117c14594119ec54553faeba119bbb4006bda5a68c5c254cd1eb'; // register candidate 1 (docs/flow-testnet.json)
const SEPOLIA_ADDR = '0xbBC97a57c7f81F77dbA1b1b2FbC29898b87F7bDF';
const RPC_SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const RPC_SEPOLIA_TRACE = 'https://sepolia.drpc.org'; // allows custom JS tracers on debug_traceTransaction
const RPC_MAINNET = 'https://ethereum-rpc.publicnode.com'; // read-only: eth_estimateGas with a state override, nothing is sent
const PROBE_ADDR = '0x00000000000000000000000000000000000c0de1';
const PROBE_1 = '0x600160015500';
const PROBE_4 = '0x600160015560016002556001600355600160045500';
const JS_TRACER = '{data:[],fault:function(){},step:function(l){if(l.op.toString()==="SSTORE"){this.data.push(l.getCost())}},result:function(){return this.data}}';

async function rpc(url, method, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${url} ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}
const stripMetadata = (hex) => { const n = parseInt(hex.slice(-4), 16); return hex.slice(0, hex.length - 4 - n * 2); };
const initFor = (runtime) => { const len = (runtime.length - 2) / 2; return '0x' + '60' + len.toString(16).padStart(2, '0') + '80600b6000396000f3' + runtime.slice(2); };

(async () => {
  const out = { measuredAt: new Date().toISOString(), compiler: hre.config.solidity.compilers[0], sepoliaTx: SEPOLIA_TX };
  const tx = await rpc(RPC_SEPOLIA, 'eth_getTransactionByHash', [SEPOLIA_TX]);
  const rcpt = await rpc(RPC_SEPOLIA, 'eth_getTransactionReceipt', [SEPOLIA_TX]);
  out.sepoliaGasUsed = parseInt(rcpt.gasUsed, 16);
  // 1. same bytecode?
  const art = await hre.artifacts.readArtifact('RetirementRegistry');
  const remote = await rpc(RPC_SEPOLIA, 'eth_getCode', [SEPOLIA_ADDR, 'latest']);
  out.bytecodeLengthLocal = (art.deployedBytecode.length - 2) / 2;
  out.bytecodeLengthSepolia = (remote.length - 2) / 2;
  out.bytecodeEqualWithoutMetadata = stripMetadata(art.deployedBytecode.toLowerCase()) === stripMetadata(remote.toLowerCase());
  out.bytecodeEqualFull = art.deployedBytecode.toLowerCase() === remote.toLowerCase();
  // 2. same calldata locally
  const [owner] = await hre.ethers.getSigners();
  const F = await hre.ethers.getContractFactory('RetirementRegistry');
  const c = await F.deploy(); await c.waitForDeployment();
  await (await c.addAttestor(owner.address)).wait();
  const sent = await owner.sendTransaction({ to: await c.getAddress(), data: tx.input });
  const lr = await sent.wait();
  out.localGasUsedSameCalldata = Number(lr.gasUsed);
  const lt = await hre.network.provider.send('debug_traceTransaction', [sent.hash]);
  const lsst = lt.structLogs.filter((s) => s.op === 'SSTORE');
  out.local = { sstoreCount: lsst.length, sstoreCosts: lsst.map((s) => s.gasCost) };
  // 3. Sepolia trace of the real transaction
  const st = await rpc(RPC_SEPOLIA_TRACE, 'debug_traceTransaction', [SEPOLIA_TX, { tracer: JS_TRACER }]);
  out.sepolia = { sstoreCount: st.length, sstoreCosts: st };
  const pre = await rpc(RPC_SEPOLIA_TRACE, 'debug_traceTransaction', [SEPOLIA_TX, { tracer: 'prestateTracer', tracerConfig: { diffMode: true } }]);
  out.sepolia.slotsWrittenInRegistry = Object.keys((pre.post[SEPOLIA_ADDR.toLowerCase()] || {}).storage || {}).length;
  // 4. chain-level probe: a 6-byte contract that writes 1 (or 4) new storage slots, no code of ours involved
  const est = async (url) => ({
    oneSlot: parseInt(await rpc(url, 'eth_estimateGas', [{ from: '0x0000000000000000000000000000000000000001', to: PROBE_ADDR }, 'latest', { [PROBE_ADDR]: { code: PROBE_1 } }]), 16),
    fourSlots: parseInt(await rpc(url, 'eth_estimateGas', [{ from: '0x0000000000000000000000000000000000000001', to: PROBE_ADDR }, 'latest', { [PROBE_ADDR]: { code: PROBE_4 } }]), 16),
  });
  out.probe = { sepolia: await est(RPC_SEPOLIA), mainnetReadOnly: await est(RPC_MAINNET) };
  const probeLocal = async (rt) => { const d = await owner.sendTransaction({ data: initFor(rt) }); const dr = await d.wait(); const t = await owner.sendTransaction({ to: dr.contractAddress, data: '0x' }); return Number((await t.wait()).gasUsed); };
  out.probe.local = { oneSlot: await probeLocal(PROBE_1), fourSlots: await probeLocal(PROBE_4) };
  // 5. which fork? header fields that only newer forks add
  for (const [name, url] of [['sepolia', RPC_SEPOLIA], ['mainnet', RPC_MAINNET]]) {
    const b = await rpc(url, 'eth_getBlockByNumber', ['latest', false]);
    out[`${name}Header`] = { block: parseInt(b.number, 16), hasBlockAccessListHash: 'blockAccessListHash' in b, hasSlotNumber: 'slotNumber' in b };
  }
  const perSlot = (p) => Math.round((p.fourSlots - p.oneSlot) / 3);
  out.perNewSlotGas = { local: perSlot(out.probe.local), sepolia: perSlot(out.probe.sepolia), mainnetReadOnly: perSlot(out.probe.mainnetReadOnly) };
  out.perNewSlotGas.sepoliaOverLocal = +(out.perNewSlotGas.sepolia / out.perNewSlotGas.local).toFixed(2);
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'gas-diagnosis.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
