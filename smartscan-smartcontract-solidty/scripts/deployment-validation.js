import { getAddress, isAddress, ZeroAddress } from "ethers";

/**
 * Validate optional role assignments before a deployment transaction is sent.
 * A participant cannot be the deployment owner because the owner is already
 * the contract's Admin and grantRole deliberately rejects role conflicts.
 */
function validateInitialAssignments(assignments, deployerAddress) {
  const configured = [];
  for (const assignment of assignments) {
    const { address: rawAddress, name: rawName, role, roleName } = assignment;
    if (!rawAddress && !rawName) continue;
    if (!isAddress(rawAddress || "") || getAddress(rawAddress) === ZeroAddress || !rawName || !rawName.trim()
      || Buffer.byteLength(rawName.trim(), "utf8") > 100) {
      throw new Error(`A valid non-zero address and business name are required for ${roleName}`);
    }
    configured.push({ address: getAddress(rawAddress), name: rawName.trim(), role, roleName });
  }

  if (new Set(configured.map(({ address }) => address.toLowerCase())).size !== configured.length) {
    throw new Error("Initial manufacturer, supplier, and retailer wallets must be unique");
  }
  if (!isAddress(deployerAddress || "") || getAddress(deployerAddress) === ZeroAddress) {
    throw new Error("A valid non-zero deployment owner wallet is required");
  }
  if (configured.some(({ address }) => address.toLowerCase() === getAddress(deployerAddress).toLowerCase())) {
    throw new Error("Initial participant wallets must differ from the deployment owner wallet");
  }
  return configured;
}

export { validateInitialAssignments };
