import { getAddress, isAddress, ZeroAddress } from "ethers";

const ROLE_IDS = Object.freeze({ admin: 1, manufacturer: 2, supplier: 3, retailer: 4 });
const NETWORK_CHAIN_IDS = Object.freeze({
  default: 31337,
  sepolia: 11155111,
  mainnet: 1,
});

function chainIdForNetwork(networkName, env = process.env) {
  if (networkName === "production") {
    const configured = env.PRODUCTION_CHAIN_ID;
    if (!/^[1-9][0-9]*$/.test(configured || "")) return undefined;
    const chainId = Number(configured);
    return Number.isSafeInteger(chainId) ? chainId : undefined;
  }
  return NETWORK_CHAIN_IDS[networkName];
}

function validateRoleConfig(env, networkName) {
  const expectedChainId = chainIdForNetwork(networkName, env);
  if (expectedChainId === undefined) {
    throw new Error("Unsupported or missing network; use the local default, sepolia, mainnet, or configure the production network");
  }
  const action = env.ROLE_ACTION;
  const roleName = env.ROLE_NAME;
  const address = env.CONTRACT_ADDRESS;
  const account = env.ROLE_ADDRESS;
  if (action !== "grant" && action !== "revoke") throw new Error("ROLE_ACTION must be exactly grant or revoke");
  if (!Object.hasOwn(ROLE_IDS, roleName)) throw new Error("ROLE_NAME must be admin, manufacturer, supplier, or retailer");
  if (typeof address !== "string" || !isAddress(address) || getAddress(address) === ZeroAddress) {
    throw new Error("CONTRACT_ADDRESS must be a valid non-zero wallet address");
  }
  if (typeof account !== "string" || !isAddress(account) || getAddress(account) === ZeroAddress) {
    throw new Error("ROLE_ADDRESS must be a valid non-zero wallet address");
  }
  if (getAddress(address) === getAddress(account)) {
    throw new Error("CONTRACT_ADDRESS and ROLE_ADDRESS must be different");
  }
  if (action === "grant" && (typeof env.ROLE_BUSINESS_NAME !== "string" || !env.ROLE_BUSINESS_NAME.trim()
    || Buffer.byteLength(env.ROLE_BUSINESS_NAME.trim(), "utf8") > 100)) {
    throw new Error("ROLE_BUSINESS_NAME is required and must be at most 100 UTF-8 bytes when granting a role");
  }
  const confirmation = `${action}:${roleName}:${getAddress(account)}`;
  if (env.ROLE_CONFIRMATION !== confirmation) {
    throw new Error(`Set ROLE_CONFIRMATION=${confirmation} to confirm this role change`);
  }
  return { action, roleName, roleId: ROLE_IDS[roleName], contractAddress: getAddress(address), account: getAddress(account), expectedChainId };
}

export { ROLE_IDS, NETWORK_CHAIN_IDS, chainIdForNetwork, validateRoleConfig };
