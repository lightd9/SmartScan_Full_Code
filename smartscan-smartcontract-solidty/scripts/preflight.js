import { getAddress, isAddress, ZeroAddress } from "ethers";
import { network } from "hardhat";
import { chainIdForNetwork } from "./role-admin-validation.js";
import { validateInitialAssignments } from "./deployment-validation.js";

async function main() {
  const { ethers, networkName } = await network.getOrCreate();
  const expectedChainId = chainIdForNetwork(networkName);
  if (expectedChainId === undefined) throw new Error("Unsupported or missing deployment network");
  const chain = await ethers.provider.getNetwork();
  if (Number(chain.chainId) !== expectedChainId) {
    throw new Error(`Network chain ID mismatch: expected ${expectedChainId}, got ${chain.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  const balance = deployer ? await ethers.provider.getBalance(deployer.address) : 0n;
  const rawAssignments = [
    { address: process.env.MANUFACTURER_ADDRESS, name: process.env.MANUFACTURER_NAME, role: 2, roleName: "manufacturer" },
    { address: process.env.SUPPLIER_ADDRESS, name: process.env.SUPPLIER_NAME, role: 3, roleName: "supplier" },
    { address: process.env.RETAILER_ADDRESS, name: process.env.RETAILER_NAME, role: 4, roleName: "retailer" },
  ];
  const hasAssignments = rawAssignments.some(({ address, name }) => address || name);
  if (!deployer && hasAssignments) throw new Error("A deployment signer is required when initial participant assignments are configured");
  const assignments = deployer ? validateInitialAssignments(rawAssignments, deployer.address) : [];

  const configuredContract = process.env.CONTRACT_ADDRESS || "";
  let contractState = { configured: false };
  if (configuredContract) {
    if (!isAddress(configuredContract) || getAddress(configuredContract) === ZeroAddress) {
      throw new Error("CONTRACT_ADDRESS must be a valid non-zero address");
    }
    const address = getAddress(configuredContract);
    const code = await ethers.provider.getCode(address);
    if (code === "0x") throw new Error(`CONTRACT_ADDRESS has no bytecode on ${networkName}`);
    const contract = await ethers.getContractAt("IdenteefiV2", address);
    contractState = {
      configured: true,
      address,
      owner: await contract.owner(),
      pendingOwner: await contract.pendingOwner(),
    };
  }

  console.log(JSON.stringify({
    network: networkName,
    chainId: Number(chain.chainId),
    deployer: deployer?.address || null,
    deployerBalance: ethers.formatEther(balance) + " ETH",
    initialAssignments: assignments,
    contract: contractState,
    writesSubmitted: false,
  }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
