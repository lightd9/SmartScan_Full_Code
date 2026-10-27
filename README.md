# SmartScan: Blockchain-Integrated Mobile App for Authenticating Medicines and Consumer Goods

SmartScan is a blockchain-integrated web application for recording and checking
product provenance. A QR code identifies a product on a configured smart
contract; consumers can compare its append-only custody history and current
custodian/stage with the physical seller. The currently configured deployment is
on Sepolia (a test network), not a production chain.

## Key Features

- **On-chain provenance:** QR codes identify a contract + serial; the backend
  verifies scan results against the configured chain and contract. Product
  registration and custody history remain publicly readable on-chain.
- **QR code scanning:** consumers scan a product code to verify authenticity and
  view its full supply-chain history.
- **Role-based access:** JWT-protected accounts and dashboards for Admin,
  Manufacturer, Supplier and Retailer roles.
- **Product tracking:** append-only manufacturing/distribution/sold history.
- **Chain lifecycle tracking:** products move through `pending_wallet` →
  `submitted` → `confirmed`, `failed` or `needs_retry`; only the backend worker
  can confirm a registration after verifying its chain, contract, signer, receipt
  and `ProductRegistered` event.
- **Scan monitoring:** invalid identifiers, unusual scan frequency, suspicious
  location patterns and conflicting chain state can be flagged for review.
- **Responsive UI:** React single-page app; can be wrapped for Android with Capacitor.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, ethers |
| Backend | Node.js 24 + Express, JWT auth, ethers |
| Database | PostgreSQL |
| Rate limits / media | Redis-compatible TLS service / private S3-compatible object storage in production |
| Blockchain | Solidity 0.8.17, Hardhat 3, ethers 6; configured test deployment on Sepolia |

```
smartscan-frontend-react/     # React SPA + Capacitor Android wrapper
smartscan-backend-node/       # Express API (app.js factory, postgres.js entry)
smartscan-smartcontract-solidty/  # Hardhat project + Solidity contracts
smartscan-postgres-database/  # SQL schema + seed data
```

## Prerequisites

- Node.js 24 LTS (pinned in `.nvmrc` and required by package engine constraints)
- npm
- PostgreSQL
- MetaMask (for manufacturer/supplier/retailer writes)

## Setup

### 1. Backend

```bash
cd smartscan-backend-node
npm ci
copy .env.example .env    # then edit values
npm run migrate:preflight # read-only compatibility/data report
npm run migrate           # apply database migrations (idempotent)
npm start
```

For a brand-new database, first apply
`smartscan-postgres-database/schema.sql`; the preflight command is for an
existing database and intentionally fails when the three legacy base tables
are absent. Never import the CSV fixtures into production.

Run the preflight against a recent, isolated copy of the existing database
before upgrading. It blocks on duplicate keys, invalid roles, and orphaned
relations that would make integrity constraints fail. Existing `confirmed`
rows are reported for review; migration `005` conservatively moves every
legacy confirmation back to `submitted` (valid transaction hash) or
`needs_retry` (missing/invalid hash). The reconciler must verify chain,
contract, sender, receipt, and registration event before a product is
`confirmed` again. Back up the database first; the migration runner applies
each numbered migration transactionally and records it in `schema_migrations`.
Migration `008_password_session_revocation.sql` adds password-event auditing and a
token version so changing or resetting a password revokes the target account's
existing JWT sessions. Password changes require the acting account's current
password; new passwords must contain at least 12 characters.
Migrations `009` and `010` add evidence-backed admin audits for assigning an
ownerless manufacturer and rekeying noncanonical legacy IDs. These operations
do not prove authenticity or confirm chain registration; the configured-chain
checks and subsequent manufacturer wallet registration/reconciliation remain
required. Never perform them without authoritative source records.

`npm run migrate-passwords` is a one-off helper that hashes any legacy plaintext
passwords; login also upgrades them automatically. The API listens on `PORT`
(default 5000).

### 2. Frontend

```bash
cd smartscan-frontend-react
npm ci --legacy-peer-deps
copy .env.example .env
npm start
```

Runs at http://localhost:5173 by default (Vite).

### 3. Smart contract

```bash
cd smartscan-smartcontract-solidty
npm ci
npm test
npx hardhat run scripts/deploy-v2.js --network sepolia
```

## Environment Variables

**Backend**

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string; TLS required for production |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing secret and positive token lifetime (`s`, `m`, `h`, or `d`; production maximum 90 days) |
| `ALLOWED_ORIGINS`, `WALLET_LINK_ORIGIN` | Exact browser origins allowed by CORS and wallet-link challenges |
| `CHAIN_RPC_URL`, `CHAIN_ID`, `CONTRACT_ADDRESS`, `CONTRACT_DEPLOYMENT_BLOCK` | Backend's authoritative chain/deployment configuration |
| `REDIS_URL` | Shared rate-limit store; use `rediss://` in production |
| `TRUST_PROXY_HOPS` | Exact trusted proxy hops; required and nonzero in production |
| `SCAN_RETENTION_DAYS` | Explicit privacy/legal retention period required in production; used by the supervised scan-retention worker |
| `UPLOAD_STORAGE_DRIVER` | `local` for development; `s3` with private bucket for production |
| `UPLOAD_S3_BUCKET`, `UPLOAD_S3_REGION` | Required for S3-compatible production storage |
| `PGSSL_DISABLE` | Local-only option to disable Postgres TLS; never set in production |

**Frontend**

| Variable | Description |
| --- | --- |
| `REACT_APP_API_URL` | HTTPS base URL of the deployed backend API; required for production because Vercel does not proxy API requests |
| `REACT_APP_CONTRACT_ADDRESS` | V2 contract address for QR links and wallet writes |
| `REACT_APP_CHAIN_ID`, `REACT_APP_CHAIN_RPC_URL`, `REACT_APP_BLOCK_EXPLORER_URL` | Public settings; must match the backend/deployment. Frontend RPC URLs are exposed in the browser bundle, so use a public/read-only or origin-restricted endpoint, never a secret credential |
| `REACT_APP_CHAIN_NAME`, `REACT_APP_NATIVE_CURRENCY_*` | Required for non-Sepolia/non-mainnet EVM networks; configure the correct wallet-add network metadata |
| `REACT_APP_GEOCODING_API_KEY` | Optional geocoding key; does not provide trusted scan location |

**Contract** (`smartscan-smartcontract-solidty`)

| Variable | Description |
| --- | --- |
| `SEPOLIA_QUICKNODE_KEY` / `PROD_QUICKNODE_KEY` | RPC URL for Sepolia / Ethereum mainnet (QuickNode or another compatible provider) |
| `PRODUCTION_RPC_URL`, `PRODUCTION_CHAIN_ID` | HTTPS RPC + positive chain ID for the explicitly selected non-mainnet production EVM network; both required together |
| `PRIVATE_KEY` | Deployer wallet private key |
| `MANUFACTURER_ADDRESS` / `SUPPLIER_ADDRESS` / `RETAILER_ADDRESS` and corresponding `*_NAME` | Optional explicit initial role grants; never hardcode participant identities |
| `CONTRACT_ADDRESS`, `ROLE_ADDRESS`, `ROLE_NAME`, `ROLE_ACTION`, `ROLE_CONFIRMATION` | Explicitly confirmed role administration/inspection configuration |
| `OWNER_ACTION`, `OWNER_ADDRESS`, `OWNER_CONFIRMATION` | Explicitly confirmed two-step ownership proposal or Safe-acceptance preparation |

> Network configurations are registered when their RPC URL is present. A
> `PRIVATE_KEY` is optional for read-only inspection and Safe-acceptance calldata
> preparation; submit/propose/grant actions need the appropriate signing wallet.

## Roles and Lifecycle

The hardened `IdenteefiV2` contract defines `Admin`, `Manufacturer`, `Supplier`
and `Retailer` roles:

- manufacturers register products;
- manufacturers, suppliers and retailers may append history;
- only the recorded retailer may mark a product sold; admins can recall products but cannot fabricate a sale event;
- duplicate serial numbers are rejected and unknown serials cannot receive history.

On the backend, a product starts as `pending_wallet`. Once the wallet returns a
transaction hash, the frontend immediately submits it to the backend and the
product becomes `submitted`. The client cannot set terminal status. The scheduled
reconciler verifies the configured chain ID, destination contract, linked
manufacturer wallet, successful receipt, confirmation depth, and the exact
`ProductRegistered` event before setting `confirmed`. It also searches for that
event to recover a hash lost when the browser closes. Wallet prompts with no
hash/event and transactions without a receipt eventually become `needs_retry`;
manufacturers can resume those registrations using the same serial number.
Individual attempts and their transaction hashes are retained for audit.

## Tests

```bash
# Backend API (node:test + supertest)
cd smartscan-backend-node && npm test

# Smart contract (Hardhat 3 / Ethers 6)
cd smartscan-smartcontract-solidty && npm test

# Frontend (Vite / Vitest)
cd smartscan-frontend-react && npm test
```

CI runs all three suites via `.github/workflows/ci.yml` on Node 24 and blocks high/critical production dependency advisories.

## Security Notes

The backend stores passwords as salted scrypt hashes, uses parameterized SQL
everywhere, issues JWTs via `POST /auth`, restricts write endpoints to the
appropriate roles, validates input, limits JSON bodies and uploads, and sets
basic security headers. Secrets live in untracked `.env` files; commit only the
`.env.example` templates.

### Deployment status

The legacy deployed contract has no access control and cannot be upgraded. The
application targets the role-aware V2 interface. The configured V2 deployment
on Sepolia is for testing only; it is not evidence of a production deployment.
Choosing a production chain, deploying a new contract, transferring ownership to
the organization's multisig, configuring production services, and completing
business-wallet onboarding remain launch prerequisites. See
[`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) and
[`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md).

## Product identity, custody, and scan warnings

New product identifiers are generated by the manufacturer interface in the
`SS-<UUID>` format and validated by both the API and V2 contract. The contract
rejects duplicate identifiers. Each custody history entry records the writing
wallet and the business name registered for that wallet by the contract owner.

The custody flow is Manufacturer → Supplier → Retailer. The current custodian
dispatches to a wallet with the next role; only that wallet can confirm
delivery. A delivered retailer may mark the product sold. The product's
manufacturer or an admin may recall it. Recalled items are flagged on scan and
cannot resume normal dispatch or sale. Consumers can compare the recorded
retailer and custody history with the seller and location where they found the
product.

The scanner sends a scan to the backend, which derives validity and conflicting
state from the configured chain; client-supplied outcome/conflict claims are not
trusted. Consumers may opt in to sharing approximate scan location. This is
browser-reported and spoofable, not proof of physical presence. Monitoring flags
invalid identifiers, at least ten scans of one identifier within ten minutes,
scans of the same identifier more than 100 km apart within one hour, and a
mismatch between the last history action and the current contract stage. These
are review warnings, not proof of counterfeiting. Coordinates are rounded before
storage and tagged with their source; visitor IPs are stored as keyed hashes.
Admins can review alerts at `/admin/operations`. Configure retention for
`product_scans` using required production `SCAN_RETENTION_DAYS`; the supervised
`npm run scan-retention:worker` deletes expired scan records in batches after
migration `007_scan_retention_index.sql` is applied.

## Business account and wallet binding

Application accounts are linked to unique business wallets in the backend. A
user proves wallet ownership by signing a server-generated, single-use challenge
that expires after five minutes. The backend checks the signature and confirms
that the on-chain role matches the application account before binding the
wallet. Supply-chain writes are offered only after the authenticated account,
connected wallet, and on-chain role agree.

Administrators can link, replace, suspend, restore, or revoke business wallets.
Link and replacement require proof from the new wallet; the contract owner must
submit the chain transaction. Replacement revokes the old role and grants the
new wallet in one transaction, while existing product custody resolves to the
replacement without rewriting historical events. The backend updates the
account only after confirming the owner transaction and resulting contract
state. Wallet changes are recorded in the wallet-operation and wallet-account
audit tables. Apply migration `003_wallet_accounts.sql` and configure the
backend RPC URL, V2 contract address, and wallet-link origin before enabling
these flows.

For a multisig-owned contract, the admin can choose Safe execution in Manage
Account. The UI provides the contract target and encoded call; after Safe
execution, the backend verifies the configured chain, that the transaction
targeted the current contract owner Safe, the exact role-change event, and the
resulting contract state before completing the database operation. Direct owner
EOA execution remains available for controlled test environments.

## Author

Contract ownership is a separate two-step operation. The contract project now
provides `npx hardhat run scripts/manage-ownership.js --network <sepolia|mainnet>` with strict
confirmation values. `OWNER_ACTION=propose` submits the transfer proposal from
the current owner. For a Safe pending owner, `OWNER_ACTION=prepare-safe-accept`
prints the verified target/calldata for the Safe to execute; the script does not
try to impersonate the Safe. `inspect:roles` reports current/pending ownership
and associated receipts. Keep the deployer key only in the controlled
operator's secret store and remove its authority only after Safe acceptance is
verified.

Olafenwa Hassan — SmartScan
