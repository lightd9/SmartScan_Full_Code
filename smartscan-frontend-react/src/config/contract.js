import abi from '../utils/IdenteefiV2.json';

// Production deployments must provide the role-aware IdenteefiV2 address.
export const CONTRACT_ADDRESS = (
  process.env.REACT_APP_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
).trim();

export const CONTRACT_ABI = abi.abi;

// Read-only RPC used for public verification (no wallet required).
export const SEPOLIA_RPC_URL =
  process.env.REACT_APP_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';

export const SEPOLIA_CHAIN_ID = '0xaa36a7';
