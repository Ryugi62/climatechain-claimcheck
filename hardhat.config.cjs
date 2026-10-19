require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

const fs = require('fs');
// Optional public testnet. The key never lives in the repo: set IEEE_TESTNET_KEY_FILE (path) or IEEE_TESTNET_KEY (env).
const keyFromEnv = () => {
  const f = process.env.IEEE_TESTNET_KEY_FILE;
  const k = f ? fs.readFileSync(f, 'utf8').trim() : process.env.IEEE_TESTNET_KEY;
  return k ? [k.startsWith('0x') ? k : `0x${k}`] : [];
};
const networks = {};
if (process.env.IEEE_TESTNET_KEY_FILE || process.env.IEEE_TESTNET_KEY) {
  networks.testnet = { url: process.env.IEEE_TESTNET_RPC || 'https://ethereum-sepolia-rpc.publicnode.com', accounts: keyFromEnv() };
}

/** Local by default. A free public RPC and your own key are used only when the env above is set. No paid service. */
module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } },
  networks,
  paths: { tests: './tests/contract' },
};
