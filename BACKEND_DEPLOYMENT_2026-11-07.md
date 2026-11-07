# Backend deployment — 7 November 2026

The shared verification backend is live on the existing Render service. The web/mobile frontend changes and cloud iOS build configuration are separate work and were not published in this backend release.

| Item | Result |
| --- | --- |
| API | `https://smartscan-backend-52s4.onrender.com` |
| Render service | `srv-dbgc6c6c6qcc73evtqcg` |
| Deployment | `dep-dbnhd8h42hec73cebcag` |
| Released commit | `c40a93ba2828301457bc7e21127c950af123ad00` on `main` |
| Database migration | `014_scan_idempotency.sql` applied |
| Network | Existing Sepolia deployment, chain ID `11155111` |

## What was released

- Shared read-only and scan-recording assessment endpoints, explicit evidence findings and retry deduplication.
- Registry fallback wording that does not claim physical authenticity or invent a live verification time.
- Native-origin configuration support and location-input corrections already present in the prepared backend changes.

## Deployment repairs

Earlier Render deployments had failed because `OPERATIONAL_VAULT_SECRET`, `TREASURY_FAUCET_PRIVATE_KEY` and `CONTRACT_OWNER_PRIVATE_KEY` were missing. The previously live release was from 5 November.

- Configured the existing contract-owner key only after checking that its derived address matches the current Sepolia contract owner.
- Generated a new vault secret and a separate treasury wallet, stored directly in Render environment settings. No private keys or vault secrets were committed or included in this report.
- Added `LEGACY_VAULT_SECRET` for one older facility wallet; the other five still decrypt through the unchanged existing JWT secret. Verified all six with the released decryption implementation. Preserve these legacy sources until those records have been deliberately re-encrypted.
- Preserved the existing allowed web origins and added `https://localhost` and `capacitor://localhost`.
- Kept the same Neon database and credentials, using its direct endpoint for the Node service so session-level migration locks use a stable PostgreSQL connection.

## Validation

- Backend suite: 109 passed; the separate PostgreSQL integration test was skipped in that suite, then passed explicitly against PostgreSQL 18 during release rehearsal.
- Backed up the deployed PostgreSQL 18 database over verified TLS. Restored that backup into an isolated local PostgreSQL 18 cluster, applied migration 014 twice and verified idempotency and unchanged application row counts: 9 accounts, 9 profiles, 4 products, 6 facility wallets and 43 prior scan observations.
- The rehearsal server was stopped. Backup: `C:\Users\HP\AppData\Local\Temp\smartscan-backend-release-state-20261107\before-assessments-pg18.dump` (77,022 bytes). This backup contains application data; keep it private and outside Git. It is a local release backup, not a substitute for managed database backup/retention.
- Render built the release, applied migration 014 and reported the deployment live.
- Live `/healthz` and `/readyz` returned HTTP 200. Readiness confirmed database, migration 014, rate-limit storage, media storage and blockchain checks.
- Android, iOS and the existing web origin passed CORS preflight with HTTP 204; an unlisted origin was rejected with HTTP 403.
- A read-only existing-product lookup returned the new `v2-evidence-1` assessment with authoritative chain evidence.
- Two live requests using one temporary scan event ID returned HTTP 201 then HTTP 200 with `replayed: true`, producing exactly one observation. Only that specifically identified synthetic observation was removed afterward.
- No product registration, custody change, sale or blockchain transaction was performed during deployment verification.

## Remaining operational item

The new treasury address is `0xd8720284282f68A1a94F29568E9434CFda7f1a5F`. It needs **Sepolia test ETH** before it can fund facility wallets. The current funding helper sends 0.005 test ETH per default grant and also needs gas. No funds were transferred during this release. Verification endpoints do not require treasury funding.

Android/iOS hardware testing, TestFlight signing, manufacturer production imports and live enterprise integration remain separate milestones. This deployment does not move SmartScan to a production blockchain.
