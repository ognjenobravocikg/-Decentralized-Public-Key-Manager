const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

module.exports = {
  networks: {
    sepolia: {
      provider: () =>
        new HDWalletProvider({
          mnemonic: process.env.MNEMONIC,
          providerOrUrl: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
        }),
      network_id: 11155111,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: { optimizer: { enabled: true, runs: 200 } },
    },
  },
};
