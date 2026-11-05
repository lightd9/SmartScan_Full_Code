# SmartScan frontend

The frontend is a React single-page application built with Vite. It provides
public product verification, QR scanning, role-based dashboards, and retailer
point-of-sale flows. The Android wrapper is managed with Capacitor.

## Local development

```sh
npm ci --legacy-peer-deps
cp .env.example .env
npm start
```

On Windows, copy `.env.example` to `.env` in PowerShell. Set the API URL and
contract deployment values before using authenticated or blockchain features.

## Public build configuration

Vite exposes the following `REACT_APP_*` values to the client bundle:

- `REACT_APP_API_URL`
- `REACT_APP_CONTRACT_ADDRESS`
- `REACT_APP_CHAIN_ID`
- `REACT_APP_CHAIN_NAME`
- `REACT_APP_CHAIN_RPC_URL`
- `REACT_APP_BLOCK_EXPLORER_URL`
- `REACT_APP_NATIVE_CURRENCY_NAME`
- `REACT_APP_NATIVE_CURRENCY_SYMBOL`
- `REACT_APP_NATIVE_CURRENCY_DECIMALS`
- `REACT_APP_GEOCODING_API_KEY` (optional)

These are public client settings. Never put wallet private keys or other
server secrets in frontend variables. Production builds require an HTTPS API,
RPC, and explorer URL plus a nonzero contract address and explicit chain ID.

## Scripts

- `npm start` — start Vite's development server.
- `npm run build` — create the production bundle in `build/`.
- `npm test` — run the existing Vitest suite.
- `npx cap sync android` — sync web assets and plugins to the Android project.
