# SmartScan: Blockchain-Integrated Mobile App for Authenticating Medicines and Consumer Goods

SmartScan is a blockchain-powered web/mobile application that combats counterfeit
products by letting anyone verify authenticity with a QR scan while product
provenance is recorded in a tamper-resistant smart contract on the Ethereum
Sepolia testnet.

## Key Features

- **On-chain authenticity:** QR codes embed the contract address + serial number.
  The public scanner reads the product directly from the chain, so verification
  does not depend on the database.
- **QR code scanning:** consumers scan a product code to verify authenticity and
  view its full supply-chain history.
- **Role-based access:** JWT-protected accounts and dashboards for Admin,
  Manufacturer, Supplier and Retailer roles.
- **Product tracking:** append-only manufacturing/distribution/sold history.
- **Responsive UI:** React single-page app; can be wrapped for Android with Capacitor.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 17 (Create React App, react-scripts 5) |
| Backend | Node.js + Express, JWT auth |
| Database | PostgreSQL |
| Blockchain | Solidity 0.8.17 (Hardhat), deployed on Sepolia |

```
smartscan-frontend-react/     # React SPA + Capacitor Android wrapper
smartscan-backend-node/       # Express API (app.js factory, postgres.js entry)
smartscan-smartcontract-solidty/  # Hardhat project + Solidity contracts
smartscan-postgres-database/  # SQL schema + seed data
```

## Prerequisites

- Node.js (v18+; the Hardhat project is tested on Node 18/20)
- npm
- PostgreSQL
- MetaMask (for manufacturer/supplier/retailer writes)

## Setup

### 1. Backend

```bash
cd smartscan-backend-node
npm install
copy .env.example .env    # then edit values
npm run migrate-passwords # one-off: hash any legacy plaintext passwords
npm start
```

The API listens on `PORT` (default 5000).

### 2. Frontend

```bash
cd smartscan-frontend-react
npm install --legacy-peer-deps
copy .env.example .env
npm start
```

Runs at http://localhost:3000.

### 3. Smart contract

```bash
cd smartscan-smartcontract-solidty
npm install
npx hardhat test         # run contract tests
npx hardhat run scripts/deploy-v2.js --network sepolia
```

## Environment Variables

**Backend**

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs (required) |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list |
| `PGSSL_DISABLE` | Set to `1` to disable SSL (local Postgres) |

**Frontend**

| Variable | Description |
| --- | --- |
| `REACT_APP_API_URL` | Base URL of the backend API |
| `REACT_APP_CONTRACT_ADDRESS` | Deployed contract address (has a default) |
| `REACT_APP_SEPOLIA_RPC_URL` | Read-only RPC used for public verification |
| `REACT_APP_GEOCODING_API_KEY` | Google Geocoding key (optional; disables address lookup if unset) |

**Contract** (`smartscan-smartcontract-solidty`)

| Variable | Description |
| --- | --- |
| `SEPOLIA_QUICKNODE_KEY` | Sepolia RPC URL |
| `GOERLI_QUICKNODE_KEY` / `PROD_QUICKNODE_KEY` | Optional other networks |
| `PRIVATE_KEY` | Deployer wallet private key |

> Network configs are only registered when both the RPC URL and `PRIVATE_KEY`
> are present, so tests and local compilation work without any secrets.

## Tests

```bash
# Backend API (node:test + supertest)
cd smartscan-backend-node && npm test

# Smart contract (Hardhat)
cd smartscan-smartcontract-solidty && npx hardhat test

# Frontend (react-scripts / jest)
cd smartscan-frontend-react && CI=true npm test
```

## Security Notes

The backend stores passwords as salted scrypt hashes, uses parameterized SQL
everywhere, issues JWTs via `POST /auth`, and restricts write endpoints to the
appropriate roles. Secrets live in untracked `.env` files; commit only the
`.env.example` templates.

### Known limitation: deployed contract has no access control

The contract currently deployed at the configured address (see
`REACT_APP_CONTRACT_ADDRESS`) exposes `registerProduct` / `addProductHistory`
to **any caller** and cannot be upgraded. Because it cannot be redeployed to a
new address for this project, all blockchain writes are gated off-chain by the
backend/UI, but a determined actor could still call the contract directly.

A hardened source-only contract, `contracts/IdenteefiV2.sol`, is included that
adds an `onlyOwner` guard, duplicate-serial rejection, existence checks and
events. To use it, deploy it with `scripts/deploy-v2.js` and point
`REACT_APP_CONTRACT_ADDRESS` at the new address.

## Author

Olafenwa Hassan — Final Year Computer Science Project, 2025.
