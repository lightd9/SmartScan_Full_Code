require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
      console.log(account.address);
  }
});

/** @type import('hardhat/config').HardhatUserConfig */

const networks = {};

if (process.env.GOERLI_QUICKNODE_KEY && process.env.PRIVATE_KEY) {
  networks.goerli = {
    url: process.env.GOERLI_QUICKNODE_KEY,
    accounts: [process.env.PRIVATE_KEY],
  };
}

if (process.env.SEPOLIA_QUICKNODE_KEY && process.env.PRIVATE_KEY) {
  networks.sepolia = {
    url: process.env.SEPOLIA_QUICKNODE_KEY,
    accounts: [process.env.PRIVATE_KEY],
  };
}

if (process.env.PROD_QUICKNODE_KEY && process.env.PRIVATE_KEY) {
  networks.mainnet = {
    url: process.env.PROD_QUICKNODE_KEY,
    accounts: [process.env.PRIVATE_KEY],
  };
}

module.exports = {
  solidity: "0.8.17",
  networks,
};
