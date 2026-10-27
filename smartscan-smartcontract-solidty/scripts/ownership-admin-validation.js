import { getAddress, isAddress, ZeroAddress } from "ethers";
import { chainIdForNetwork } from "./role-admin-validation.js";

const ACTIONS = new Set(["propose", "accept", "prepare-safe-accept"]);

function validateOwnershipConfig(env, networkName) {
  const expectedChainId = chainIdForNetwork(networkName, env);
  if (expectedChainId === undefined) throw new Error("Unsupported or missing network; use the local default, sepolia, mainnet, or configure the production network");
  if (!ACTIONS.has(env.OWNER_ACTION)) throw new Error("OWNER_ACTION must be exactly propose, accept, or prepare-safe-accept");
  if (!isAddress(env.CONTRACT_ADDRESS || "") || getAddress(env.CONTRACT_ADDRESS) === ZeroAddress) {
    throw new Error("CONTRACT_ADDRESS must be a valid non-zero contract address");
  }
  if (!isAddress(env.OWNER_ADDRESS || "") || getAddress(env.OWNER_ADDRESS) === ZeroAddress) {
    throw new Error("OWNER_ADDRESS must be a valid non-zero proposed/pending owner address");
  }
  const contractAddress = getAddress(env.CONTRACT_ADDRESS);
  const ownerAddress = getAddress(env.OWNER_ADDRESS);
  if (contractAddress === ownerAddress) throw new Error("OWNER_ADDRESS must differ from CONTRACT_ADDRESS");
  const confirmation = `${env.OWNER_ACTION}:${ownerAddress}`;
  if (env.OWNER_CONFIRMATION !== confirmation) throw new Error(`Set OWNER_CONFIRMATION=${confirmation} to confirm this ownership action`);
  return {
    action: env.OWNER_ACTION,
    contractAddress,
    ownerAddress,
    expectedChainId,
  };
}

function validateSafeMetadata(owners, thresholdValue) {
  if (!Array.isArray(owners) || owners.length === 0 || owners.some((owner) => !isAddress(owner) || getAddress(owner) === ZeroAddress)) {
    throw new Error("Safe must expose a non-empty list of valid, non-zero owners");
  }
  const normalizedOwners = owners.map((owner) => getAddress(owner));
  if (new Set(normalizedOwners.map((owner) => owner.toLowerCase())).size !== normalizedOwners.length) {
    throw new Error("Safe owner list contains duplicate addresses");
  }
  const threshold = Number(thresholdValue);
  if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > normalizedOwners.length) {
    throw new Error("Safe threshold must be between one and the number of owners");
  }
  return { owners: normalizedOwners, threshold };
}

export { validateOwnershipConfig, validateSafeMetadata };
