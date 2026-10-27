import { Contract, Interface, ZeroAddress } from "ethers";
import { network } from "hardhat";
import { validateOwnershipConfig, validateSafeMetadata } from "./ownership-admin-validation.js";

const SAFE_READ_ABI = [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
];

async function inspectSafe(provider, address) {
  if ((await provider.getCode(address)) === "0x") throw new Error("OWNER_ADDRESS is not a deployed multisig contract");
  try {
    const safe = new Contract(address, SAFE_READ_ABI, provider);
    const [owners, thresholdValue] = await Promise.all([safe.getOwners(), safe.getThreshold()]);
    return validateSafeMetadata(owners, thresholdValue);
  } catch (error) {
    throw new Error(`OWNER_ADDRESS must be a readable Safe with a valid owner set and threshold (${error.message})`);
  }
}

async function main() {
  const { ethers, networkName } = await network.getOrCreate();
  const { provider } = ethers;
  const config = validateOwnershipConfig(process.env, networkName);
  const chain = await provider.getNetwork();
  if (Number(chain.chainId) !== config.expectedChainId) {
    throw new Error(`Network chain ID mismatch: expected ${config.expectedChainId}, got ${chain.chainId}`);
  }
  if ((await provider.getCode(config.contractAddress)) === "0x") {
    throw new Error("CONTRACT_ADDRESS has no contract code on the selected network");
  }

  const readContract = await ethers.getContractAt("IdenteefiV2", config.contractAddress);
  const [currentOwner, pendingOwner] = await Promise.all([readContract.owner(), readContract.pendingOwner()]);
  const roleAtNewOwner = Number(await readContract.roles(config.ownerAddress));
  const successor = await readContract.walletSuccessor(config.ownerAddress);

  if (config.action === "prepare-safe-accept") {
    if (pendingOwner.toLowerCase() !== config.ownerAddress.toLowerCase()) {
      throw new Error(`The configured Safe is not the pending owner; pending owner is ${pendingOwner}`);
    }
    const safe = await inspectSafe(provider, config.ownerAddress);
    const calldata = new Interface(["function acceptOwnership()"]).encodeFunctionData("acceptOwnership");
    console.log(JSON.stringify({
      action: config.action,
      network: networkName,
      chainId: Number(chain.chainId),
      target: config.contractAddress,
      safe: config.ownerAddress,
      safeOwners: safe.owners,
      safeThreshold: safe.threshold,
      method: "acceptOwnership",
      calldata,
      warning: "Submit and execute this call through the organization's verified Safe. Retain the Safe proposal and execution hashes, then inspect ownership events.",
    }, null, 2));
    return;
  }

  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error("No configured signer is available; configure PRIVATE_KEY for this ownership transaction");
  const contract = await ethers.getContractAt("IdenteefiV2", config.contractAddress, operator);
  if (config.action === "propose") {
    if (operator.address.toLowerCase() !== currentOwner.toLowerCase()) {
      throw new Error(`Configured signer ${operator.address} is not current contract owner ${currentOwner}`);
    }
    if (pendingOwner !== ZeroAddress) throw new Error(`Ownership proposal already pending for ${pendingOwner}; inspect and resolve it before proposing another`);
    if (config.ownerAddress.toLowerCase() === currentOwner.toLowerCase()) throw new Error("New owner must differ from the current owner");
    const safe = await inspectSafe(provider, config.ownerAddress);
    if (roleAtNewOwner !== 0 || successor !== ZeroAddress) {
      throw new Error("New owner must be an unused wallet with no role and no retired-wallet successor");
    }
    const tx = await contract.transferOwnership(config.ownerAddress);
    const receipt = await tx.wait();
    const nextPendingOwner = await readContract.pendingOwner();
    if (receipt.status !== 1 || nextPendingOwner.toLowerCase() !== config.ownerAddress.toLowerCase()) {
      throw new Error(`Ownership proposal could not be verified from chain state: ${tx.hash}`);
    }
    console.log(JSON.stringify({
      action: config.action,
      network: networkName,
      chainId: Number(chain.chainId),
      contract: config.contractAddress,
      previousOwner: currentOwner,
      pendingOwner: nextPendingOwner,
      safeOwners: safe.owners,
      safeThreshold: safe.threshold,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
    }, null, 2));
    return;
  }

  if (pendingOwner.toLowerCase() !== config.ownerAddress.toLowerCase()) {
    throw new Error(`Configured address is not the pending owner ${pendingOwner}`);
  }
  if ((await provider.getCode(config.ownerAddress)) !== "0x") {
    throw new Error("Pending owner is a contract wallet; use OWNER_ACTION=prepare-safe-accept and execute through that multisig");
  }
  if (operator.address.toLowerCase() !== config.ownerAddress.toLowerCase()) {
    throw new Error(`Configured signer ${operator.address} is not pending owner ${config.ownerAddress}`);
  }
  const tx = await contract.acceptOwnership();
  const receipt = await tx.wait();
  const [newOwner, nextPendingOwner] = await Promise.all([readContract.owner(), readContract.pendingOwner()]);
  if (receipt.status !== 1 || newOwner.toLowerCase() !== config.ownerAddress.toLowerCase() || nextPendingOwner !== ZeroAddress) {
    throw new Error(`Ownership acceptance could not be verified from chain state: ${tx.hash}`);
  }
  console.log(JSON.stringify({
    action: config.action,
    network: networkName,
    chainId: Number(chain.chainId),
    contract: config.contractAddress,
    previousOwner: currentOwner,
    owner: newOwner,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
  }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
