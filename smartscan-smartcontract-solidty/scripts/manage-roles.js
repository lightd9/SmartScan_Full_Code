require("dotenv").config();
const hre = require("hardhat");

const roleIds = { admin: 1, manufacturer: 2, supplier: 3, retailer: 4 };

async function main() {
  const address = process.env.CONTRACT_ADDRESS;
  const account = process.env.ROLE_ADDRESS;
  const action = (process.env.ROLE_ACTION || "grant").toLowerCase();
  const roleName = (process.env.ROLE_NAME || "").toLowerCase();
  if (!hre.ethers.utils.isAddress(address) || !hre.ethers.utils.isAddress(account)) throw new Error("CONTRACT_ADDRESS and ROLE_ADDRESS must be valid addresses");
  if (action === "grant" && !roleIds[roleName]) throw new Error("ROLE_NAME must be admin, manufacturer, supplier, or retailer");
  const [operator] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt("IdenteefiV2", address, operator);
  const tx = action === "revoke" ? await contract.revokeRole(account) : await contract.grantRole(account, roleIds[roleName]);
  await tx.wait();
  console.log(`${action} complete for ${account}; transaction: ${tx.hash}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
