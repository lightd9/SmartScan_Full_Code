import { network } from "hardhat";
import { validateRoleConfig } from "./role-admin-validation.js";

async function main() {
  const { ethers, networkName } = await network.getOrCreate();
  const { provider } = ethers;
  const config = validateRoleConfig(process.env, networkName);
  const chain = await provider.getNetwork();
  if (Number(chain.chainId) !== config.expectedChainId) throw new Error(`Network chain ID mismatch: expected ${config.expectedChainId}, got ${chain.chainId}`);
  const code = await provider.getCode(config.contractAddress);
  if (!code || code === "0x") throw new Error("CONTRACT_ADDRESS has no contract code on the selected network");

  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error("No configured admin signer is available");
  const contract = await ethers.getContractAt("IdenteefiV2", config.contractAddress, operator);
  const owner = await contract.owner();
  if (owner.toLowerCase() !== operator.address.toLowerCase()) {
    throw new Error(`Configured signer ${operator.address} is not contract owner ${owner}; submit through the owner wallet/multisig`);
  }
  if (config.action === "revoke" && config.account.toLowerCase() === owner.toLowerCase()) {
    throw new Error("Cannot revoke the contract owner; transfer ownership deliberately instead");
  }
  const currentRole = Number(await contract.roles(config.account));
  if (config.action === "grant") {
    if (currentRole !== 0) throw new Error(`Wallet already has on-chain role ${currentRole}; revoke/replace it explicitly first`);
  } else if (currentRole !== config.roleId) {
    throw new Error(`Cannot revoke: wallet role is ${currentRole}, expected ${config.roleId} (${config.roleName})`);
  }

  const tx = config.action === "revoke"
    ? await contract.revokeRole(config.account)
    : await contract.grantRole(config.account, config.roleId, process.env.ROLE_BUSINESS_NAME.trim());
  console.log(`Submitted ${config.action} ${config.roleName} for ${config.account}: ${tx.hash}`);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`Role transaction failed: ${tx.hash}`);
  const resultingRole = Number(await contract.roles(config.account));
  const resultingBusinessName = await contract.businessNames(config.account);
  if (config.action === "grant") {
    const expectedName = process.env.ROLE_BUSINESS_NAME.trim();
    if (resultingRole !== config.roleId || resultingBusinessName !== expectedName) {
      throw new Error(`Role grant receipt ${tx.hash} was mined but resulting on-chain role/profile state did not match`);
    }
  } else if (resultingRole !== 0 || resultingBusinessName !== "") {
    throw new Error(`Role revoke receipt ${tx.hash} was mined but the wallet remains authorized on-chain`);
  }
  console.log(JSON.stringify({
    action: config.action,
    role: config.roleName,
    wallet: config.account,
    network: networkName,
    chainId: Number(chain.chainId),
    contract: config.contractAddress,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
    resultingRole,
    resultingBusinessName,
  }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
