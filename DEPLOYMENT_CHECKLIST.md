# SmartScan deployment checklist

## Before deployment

- Use Node.js 20 (`.nvmrc`).
- Configure backend `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, and `PGSSL_DISABLE` as appropriate.
- Run `npm run migrate` in `smartscan-backend-node` against the target PostgreSQL database.
- Confirm that no real secrets, private keys, `.env` files, uploads, or build outputs are tracked.

## Contract deployment

- Configure `SEPOLIA_QUICKNODE_KEY` and `PRIVATE_KEY` only in the deployment environment.
- Optionally set `MANUFACTURER_ADDRESS`, `SUPPLIER_ADDRESS`, and `RETAILER_ADDRESS`.
- Run `npm run compile` and `npm test` in `smartscan-smartcontract-solidty`.
- Deploy with `npm run deploy:v2 -- --network sepolia`.
- Record and verify the deployed address on Sepolia Etherscan.
- Update the frontend contract address and ABI before releasing the frontend.
- Confirm that unauthorized wallets cannot register products or append history.

## Application verification

- Run backend tests and frontend tests/build in CI.
- Create a product and verify its lifecycle transitions from `pending_chain` to `confirmed`.
- Reject a wallet transaction and verify the product becomes `failed` with a reason.
- Scan a valid QR code from a clean browser/device.
- Test wrong-network, unavailable-RPC, missing-wallet, and expired-token behavior.
- Schedule `npm run reconcile` every 1–5 minutes and monitor `GET /product/chain-status?status=pending_chain` as an admin.
- Alert on products remaining pending beyond the expected block confirmation window.
