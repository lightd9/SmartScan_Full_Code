import { network } from "hardhat";
import { getAddress, isAddress, ZeroAddress } from "ethers";
import { chainIdForNetwork } from "./role-admin-validation.js";

async function main() {
  const { ethers, networkName } = await network.getOrCreate();
  const { provider } = ethers;
  const expectedChainId = chainIdForNetwork(networkName);
  const address = process.env.CONTRACT_ADDRESS;
  const target = process.env.ROLE_ADDRESS;
  const deploymentBlock = Number(process.env.CONTRACT_DEPLOYMENT_BLOCK);
  if (expectedChainId === undefined) throw new Error("Unsupported or missing network");
  if (!isAddress(address || "") || getAddress(address) === ZeroAddress) throw new Error("CONTRACT_ADDRESS must be a valid non-zero address");
  if (target && (!isAddress(target) || getAddress(target) === ZeroAddress)) throw new Error("ROLE_ADDRESS must be a valid non-zero address when supplied");
  if (!Number.isSafeInteger(deploymentBlock) || deploymentBlock < 0) throw new Error("CONTRACT_DEPLOYMENT_BLOCK must be configured to bound the audit query");
  const chain = await provider.getNetwork();
  if (Number(chain.chainId) !== expectedChainId) throw new Error(`Network chain ID mismatch: expected ${expectedChainId}, got ${chain.chainId}`);
  if ((await provider.getCode(address)) === "0x") throw new Error("CONTRACT_ADDRESS has no contract code on the selected network");

  const contract = await ethers.getContractAt("IdenteefiV2", address);
  const roleNames = ["None", "Admin", "Manufacturer", "Supplier", "Retailer"];
  const owner = await contract.owner();
  const pendingOwner = await contract.pendingOwner();
  const normalizedTarget = target ? getAddress(target) : null;
  const filters = [contract.filters.RoleGranted(normalizedTarget), contract.filters.RoleRevoked(normalizedTarget)];
  const events = (await Promise.all(filters.map((filter) => contract.queryFilter(filter, deploymentBlock, "latest")))).flat();
  const records = [];
  for (const event of events.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)) {
    const receipt = await provider.getTransactionReceipt(event.transactionHash);
    records.push({ event: event.fragment.name, role: roleNames[Number(event.args.role)] || "Unknown", transactionHash: event.transactionHash, blockNumber: event.blockNumber, receiptStatus: receipt ? receipt.status : null, gasUsed: receipt ? receipt.gasUsed.toString() : null });
  }
  const ownershipEvents = await Promise.all([
    contract.queryFilter(contract.filters.OwnershipTransferStarted(), deploymentBlock, "latest"),
    contract.queryFilter(contract.filters.OwnershipTransferred(), deploymentBlock, "latest"),
  ]);
  const ownership = [];
  for (const event of ownershipEvents.flat().sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)) {
    const receipt = await provider.getTransactionReceipt(event.transactionHash);
    ownership.push({ event: event.fragment.name, previousOwner: event.args.previousOwner, newOwner: event.args.newOwner, transactionHash: event.transactionHash, blockNumber: event.blockNumber, receiptStatus: receipt ? receipt.status : null, gasUsed: receipt ? receipt.gasUsed.toString() : null });
  }
  const observedWallets = new Set(events.map((event) => event.args.account.toLowerCase()));
  if (normalizedTarget) observedWallets.add(normalizedTarget.toLowerCase());
  const currentRoles = [];
  for (const wallet of observedWallets) {
    const [role, businessName] = await Promise.all([contract.roles(wallet), contract.businessNames(wallet)]);
    currentRoles.push({ wallet: getAddress(wallet), role: roleNames[Number(role)] || "Unknown", businessName });
  }
  currentRoles.sort((a, b) => a.wallet.localeCompare(b.wallet));
  console.log(JSON.stringify({ network: networkName, chainId: Number(chain.chainId), contract: getAddress(address), owner, pendingOwner, currentRoles, roleEvents: records, ownershipEvents: ownership }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
