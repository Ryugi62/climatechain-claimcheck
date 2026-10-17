require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

/** Local-only. No RPC URL, no private key, no paid service. */
module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } },
  paths: { tests: './tests/contract' },
};
