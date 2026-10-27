import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    const address = env.REACT_APP_CONTRACT_ADDRESS || '';
    const chainId = env.REACT_APP_CHAIN_ID || '';
    const rpcUrl = env.REACT_APP_CHAIN_RPC_URL || '';
    const explorerUrl = env.REACT_APP_BLOCK_EXPLORER_URL || '';
    const apiUrl = env.REACT_APP_API_URL || '';
    const chainNumber = Number(chainId);
    if (!/^0x(?!0{40}$)[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error('Production frontend build requires a nonzero REACT_APP_CONTRACT_ADDRESS');
    }
    if (!/^[1-9][0-9]*$/.test(chainId)) throw new Error('Production frontend build requires an explicit positive REACT_APP_CHAIN_ID');
    if (!/^https:\/\//i.test(rpcUrl)) throw new Error('Production frontend build requires an HTTPS chain RPC URL');
    if (!/^https:\/\//i.test(explorerUrl)) throw new Error('Production frontend build requires an HTTPS block explorer URL');
    if (!/^https:\/\//i.test(apiUrl)) throw new Error('Production frontend build requires an HTTPS REACT_APP_API_URL pointing to the deployed backend');
    if (![1, 11155111].includes(chainNumber)
      && (!env.REACT_APP_CHAIN_NAME || !env.REACT_APP_NATIVE_CURRENCY_NAME || !env.REACT_APP_NATIVE_CURRENCY_SYMBOL || !env.REACT_APP_NATIVE_CURRENCY_DECIMALS)) {
      throw new Error('Nonstandard EVM networks require explicit chain name and native currency configuration');
    }
  }
  const publicEnvNames = [
    'REACT_APP_API_URL',
    'REACT_APP_CONTRACT_ADDRESS',
    'REACT_APP_CHAIN_ID',
    'REACT_APP_CHAIN_NAME',
    'REACT_APP_CHAIN_RPC_URL',
    'REACT_APP_SEPOLIA_RPC_URL',
    'REACT_APP_BLOCK_EXPLORER_URL',
    'REACT_APP_NATIVE_CURRENCY_NAME',
    'REACT_APP_NATIVE_CURRENCY_SYMBOL',
    'REACT_APP_NATIVE_CURRENCY_DECIMALS',
    'REACT_APP_GEOCODING_API_KEY',
  ];

  return {
    plugins: [react()],
    define: Object.fromEntries(
      publicEnvNames.map((name) => [`process.env.${name}`, JSON.stringify(env[name] || '')])
    ),
    // The existing CRA app contains JSX in .js files; preserve that source layout.
    esbuild: { loader: 'jsx', include: /src\/.*\.[jt]sx?$/, exclude: [] },
    build: { outDir: 'build', sourcemap: false },
    test: { globals: true, environment: 'jsdom' },
  };
});
