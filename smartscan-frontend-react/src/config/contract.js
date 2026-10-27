import abi from '../utils/IdenteefiV2.json';

// Public, build-time deployment settings. Match chain ID, RPC, explorer and
// contract address to the same deployment; none of these values is a secret.
export const CONTRACT_ADDRESS = (
  process.env.REACT_APP_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
).trim();

export const CONTRACT_ABI = abi.abi;

const configuredChainId = process.env.REACT_APP_CHAIN_ID || '11155111';
export const CHAIN_ID = Number(configuredChainId);
if (!Number.isSafeInteger(CHAIN_ID) || CHAIN_ID <= 0) throw new Error('REACT_APP_CHAIN_ID must be a positive integer');
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
export const CHAIN_NAME = process.env.REACT_APP_CHAIN_NAME || (CHAIN_ID === 11155111 ? 'Sepolia Test Network' : CHAIN_ID === 1 ? 'Ethereum Mainnet' : 'Configured EVM Network');
export const NATIVE_CURRENCY_NAME = process.env.REACT_APP_NATIVE_CURRENCY_NAME || 'Ether';
export const NATIVE_CURRENCY_SYMBOL = process.env.REACT_APP_NATIVE_CURRENCY_SYMBOL || 'ETH';
export const NATIVE_CURRENCY_DECIMALS = Number(process.env.REACT_APP_NATIVE_CURRENCY_DECIMALS || '18');
if (!Number.isInteger(NATIVE_CURRENCY_DECIMALS) || NATIVE_CURRENCY_DECIMALS < 0 || NATIVE_CURRENCY_DECIMALS > 255) {
  throw new Error('REACT_APP_NATIVE_CURRENCY_DECIMALS must be an integer from 0 to 255');
}

// Read-only RPC and explorer are public configuration, not credentials.
export const CHAIN_RPC_URL =
  process.env.REACT_APP_CHAIN_RPC_URL || process.env.REACT_APP_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
export const BLOCK_EXPLORER_URL =
  (process.env.REACT_APP_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io').replace(/\/$/, '');

export async function assertConfiguredChain(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`Read RPC chain mismatch: expected ${CHAIN_ID}, received ${network.chainId}`);
  }
  return network;
}
