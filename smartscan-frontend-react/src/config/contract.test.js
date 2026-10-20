import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  SEPOLIA_RPC_URL,
  SEPOLIA_CHAIN_ID,
} from './contract';

describe('contract config', () => {
  it('exposes the deployed contract address', () => {
    expect(CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('exposes an ABI with the functions the app calls', () => {
    const names = CONTRACT_ABI.map((entry) => entry.name).filter(Boolean);
    expect(names).toContain('registerProduct');
    expect(names).toContain('addProductHistory');
    expect(names).toContain('getProduct');
  });

  it('exposes a Sepolia RPC URL and chain id', () => {
    expect(SEPOLIA_RPC_URL).toMatch(/^https?:\/\//);
    expect(SEPOLIA_CHAIN_ID).toBe('0xaa36a7');
  });
});
