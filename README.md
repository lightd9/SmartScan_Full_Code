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
- **Chain lifecycle tracking:** products move through `pending_chain` →
  `confirmed` or `failed`, with the transaction hash, chain ID and failure reason
  stored alongside the product.
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

- Node.js 20 (pinned in `.nvmrc`)
- npm
- PostgreSQL
- MetaMask (for manufacturer/supplier/retailer writes)

## Setup

### 1. Backend

```bash
cd smartscan-backend-node
npm install
copy .env.example .env    # then edit values
npm run migrate           # apply database migrations (idempotent)
npm start
```

`npm run migrate-passwords` is a one-off helper that hashes any legacy plaintext
passwords; login also upgrades them automatically. The API listens on `PORT`
(default 5000).

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
npx hardhat test
npm run deploy:v2 -- --network sepolia
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
| `MANUFACTURER_ADDRESS` / `SUPPLIER_ADDRESS` / `RETAILER_ADDRESS` | Optional wallets to grant roles during deployment |

> Network configs are only registered when both the RPC URL and `PRIVATE_KEY`
> are present, so tests and local compilation work without any secrets.

## Roles and Lifecycle

The hardened `IdenteefiV2` contract defines `Admin`, `Manufacturer`, `Supplier`
and `Retailer` roles:

- manufacturers register products;
- manufacturers, suppliers and retailers may append history;
- only retailers (and admins) may mark a product sold;
- duplicate serial numbers are rejected and unknown serials cannot receive history.

On the backend, a newly registered product starts as `pending_chain`. The frontend
updates it to `confirmed` (with transaction hash and chain ID) after the on-chain
transaction is mined, or `failed` (with a reason) if the wallet rejects or the
transaction errors.

## Tests

```bash
# Backend API (node:test + supertest)
cd smartscan-backend-node && npm test

# Smart contract (Hardhat)
cd smartscan-smartcontract-solidty && npx hardhat test

# Frontend (react-scripts / jest)
cd smartscan-frontend-react && CI=true npm test
```

CI runs all three suites via `.github/workflows/ci.yml` on Node 20.

## Security Notes

The backend stores passwords as salted scrypt hashes, uses parameterized SQL
everywhere, issues JWTs via `POST /auth`, restricts write endpoints to the
appropriate roles, validates input, limits JSON bodies and uploads, and sets
basic security headers. Secrets live in untracked `.env` files; commit only the
`.env.example` templates.

### Known limitation: deployed contract has no access control

The contract currently deployed at the configured address (see
`REACT_APP_CONTRACT_ADDRESS`) exposes `registerProduct` / `addProductHistory`
to **any caller** and cannot be upgraded. Because it cannot be redeployed to a
new address for this project, all blockchain writes are gated off-chain by the
backend/UI, but a determined actor could still call the contract directly.

A hardened, role-aware contract (`contracts/IdenteefiV2.sol`) is included that
adds role checks, duplicate-serial rejection, existence checks, retailer-only
sold status and events. To use it, deploy it with `scripts/deploy-v2.js`, grant
roles, regenerate the frontend ABI, and point `REACT_APP_CONTRACT_ADDRESS` at the
new address. See `DEPLOYMENT_CHECKLIST.md`.

## Author

Olafenwa Hassan — Final Year Computer Science Project, 2025.
