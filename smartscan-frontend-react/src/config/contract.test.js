import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  CHAIN_RPC_URL,
  CHAIN_ID,
  CHAIN_ID_HEX,
  BLOCK_EXPLORER_URL,
  CHAIN_NAME,
  NATIVE_CURRENCY_SYMBOL,
  NATIVE_CURRENCY_DECIMALS,
  assertConfiguredChain,
} from './contract';

describe('contract config', () => {
  it('exposes the deployed contract address', () => {
    expect(CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('exposes an ABI with the functions the app calls', () => {
    const names = CONTRACT_ABI.map((entry) => entry.name).filter(Boolean);
    expect(names).toContain('registerProduct');
    expect(names).toContain('dispatchProduct');
    expect(names).toContain('confirmDelivery');
    expect(names).toContain('markSold');
    expect(names).toContain('recallProduct');
    expect(names).toContain('getProduct');
    expect(names).toContain('getProductState');
  });

  it('exposes a chain RPC, positive chain id, and explorer URL', () => {
    expect(CHAIN_RPC_URL).toMatch(/^https?:\/\//);
    expect(CHAIN_ID).toBe(11155111);
    expect(CHAIN_ID_HEX).toBe('0xaa36a7');
    expect(BLOCK_EXPLORER_URL).toMatch(/^https?:\/\//);
    expect(CHAIN_NAME).toBeTruthy();
    expect(NATIVE_CURRENCY_SYMBOL).toMatch(/^[A-Z0-9]{2,12}$/);
    expect(NATIVE_CURRENCY_DECIMALS).toBe(18);
  });

  it('rejects an RPC on a different chain before reading contract data', async () => {
    await expect(assertConfiguredChain({ getNetwork: async () => ({ chainId: 1n }) }))
      .rejects.toThrow('Read RPC chain mismatch');
    await expect(assertConfiguredChain({ getNetwork: async () => ({ chainId: BigInt(CHAIN_ID) }) }))
      .resolves.toMatchObject({ chainId: BigInt(CHAIN_ID) });
  });
});
