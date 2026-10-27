import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

const productionChainId = Number(process.env.PRODUCTION_CHAIN_ID);
const productionChainConfigured = /^[1-9][0-9]*$/.test(process.env.PRODUCTION_CHAIN_ID || "")
  && Number.isSafeInteger(productionChainId);
if (Boolean(process.env.PRODUCTION_RPC_URL) !== Boolean(process.env.PRODUCTION_CHAIN_ID)) {
  throw new Error("PRODUCTION_RPC_URL and PRODUCTION_CHAIN_ID must be configured together");
}
if (process.env.PRODUCTION_RPC_URL && !/^https:\/\//i.test(process.env.PRODUCTION_RPC_URL)) {
  throw new Error("PRODUCTION_RPC_URL must use HTTPS");
}
if (process.env.PRODUCTION_CHAIN_ID && !productionChainConfigured) {
  throw new Error("PRODUCTION_CHAIN_ID must be a positive safe integer");
}

const networks = {
  ...(process.env.SEPOLIA_QUICKNODE_KEY ? {
    sepolia: {
    type: "http",
    chainType: "l1",
    chainId: 11155111,
    url: process.env.SEPOLIA_QUICKNODE_KEY,
    ...(process.env.PRIVATE_KEY ? { accounts: [process.env.PRIVATE_KEY] } : {}),
    },
  } : {}),
  ...(process.env.PROD_QUICKNODE_KEY ? {
    mainnet: {
    type: "http",
    chainType: "l1",
    chainId: 1,
    url: process.env.PROD_QUICKNODE_KEY,
    ...(process.env.PRIVATE_KEY ? { accounts: [process.env.PRIVATE_KEY] } : {}),
    },
  } : {}),
  ...(process.env.PRODUCTION_RPC_URL && productionChainConfigured ? {
    production: {
      type: "http",
      chainType: "generic",
      chainId: productionChainId,
      url: process.env.PRODUCTION_RPC_URL,
      ...(process.env.PRIVATE_KEY ? { accounts: [process.env.PRIVATE_KEY] } : {}),
    },
  } : {}),
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks,
});
