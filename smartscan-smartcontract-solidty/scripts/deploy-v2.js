import { network } from "hardhat";
import { chainIdForNetwork } from "./role-admin-validation.js";
import { validateInitialAssignments } from "./deployment-validation.js";

async function main() {
  const { ethers, networkName } = await network.getOrCreate();
  const { provider } = ethers;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No configured deployment signer is available");
  const expectedChainId = chainIdForNetwork(networkName);
  if (expectedChainId === undefined) throw new Error("Unsupported or missing deployment network");
  const chain = await provider.getNetwork();
  if (Number(chain.chainId) !== expectedChainId) throw new Error(`Network chain ID mismatch: expected ${expectedChainId}, got ${chain.chainId}`);

  // Validate every optional initial assignment before deploying, so malformed configuration
  // cannot leave a newly deployed but partially provisioned contract behind.
  const assignments = [
    [process.env.MANUFACTURER_ADDRESS, process.env.MANUFACTURER_NAME, 2, "manufacturer"],
    [process.env.SUPPLIER_ADDRESS, process.env.SUPPLIER_NAME, 3, "supplier"],
    [process.env.RETAILER_ADDRESS, process.env.RETAILER_NAME, 4, "retailer"],
  ];
  const configured = validateInitialAssignments(assignments.map(([address, name, role, roleName]) => ({ address, name, role, roleName })), deployer.address);

  console.log(`Deploying IdenteefiV2 on ${networkName} (${chain.chainId}) with admin ${deployer.address}`);
  const factory = await ethers.getContractFactory("IdenteefiV2", deployer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  const deploymentReceipt = await contract.deploymentTransaction().wait();
  console.log(JSON.stringify({ event: "deployed", address: contractAddress, owner: await contract.owner(), network: networkName, chainId: Number(chain.chainId), transactionHash: deploymentReceipt.hash, blockNumber: deploymentReceipt.blockNumber, status: deploymentReceipt.status }, null, 2));

  for (const { address, name, role, roleName } of configured) {
    const tx = await contract.grantRole(address, role, name);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error(`Initial ${roleName} role grant failed: ${tx.hash}`);
    console.log(JSON.stringify({ event: "role-granted", role: roleName, wallet: address, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, status: receipt.status, gasUsed: receipt.gasUsed.toString() }));
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
