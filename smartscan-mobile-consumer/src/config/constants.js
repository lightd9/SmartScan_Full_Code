const env = import.meta.env || {};
export const CONTRACT_ADDRESS = env.VITE_CONTRACT_ADDRESS || '0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96';
export const CHAIN_ID = Number(env.VITE_CHAIN_ID || 11155111);
export const CHAIN_NAME = env.VITE_CHAIN_NAME || 'Sepolia Testnet';
export const CHAIN_RPC_URL = env.VITE_CHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
export const BLOCK_EXPLORER_URL = env.VITE_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io';
export const API_BASE_URL = (env.VITE_API_BASE_URL || 'https://smartscan-backend-52s4.onrender.com').replace(/\/+$/, '');

export const STAGE_NAMES = {
  0: 'Not registered',
  1: 'Manufactured',
  2: 'Dispatched',
  3: 'Delivered',
  4: 'Sold to consumer',
  5: 'Recalled',
};

export const ROLE_NAMES = {
  1: 'Admin Authority',
  2: 'Certified Manufacturer',
  3: 'Logistics Supplier',
  4: 'Authorized Retailer',
};
