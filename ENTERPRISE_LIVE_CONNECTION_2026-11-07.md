# Enterprise database and wallet connection — 7 November 2026

Enterprise now signs in to the existing SmartScan backend and displays database-backed accounts, facility wallets, products and operation receipts. Operational signing uses the existing encrypted facility wallets on Sepolia. No database or wallet secrets are packaged in the mobile app.

## Release

| Component | Result |
| --- | --- |
| API | https://smartscan-backend-52s4.onrender.com |
| Render release | `dep-dbnln32vcj2c738iabsg` — live |
| Backend commit on main | `de4abec70501b79252c897b707df5e361d03990c` |
| Mobile commit | `0cd2048` on `build/native-ios-checks` |
| Database | Existing Neon PostgreSQL; migration `015_enterprise_operations.sql` |
| Blockchain | Sepolia, chain ID `11155111` |
| Contract | `0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96` |
| Treasury | `0xd8720284282f68A1a94F29568E9434CFda7f1a5F`; 0.1 test ETH observed after funding |
| Android package | `smartscan-mobile-enterprise/android/app/build/outputs/apk/debug/app-debug.apk` |
| APK SHA256 | `3386de2d727b261828e8c8c86db9d88ecaac2c9b810b54607eafde9872314748` |

The APK is an installed Capacitor Android application, signed for development testing. It was installed over the existing Enterprise app without clearing its data. Its 11 saved demo products remain separate from live database records.

## Connected behavior

- Existing username/password authentication; account roles come from the server. Tokens remain in memory, so restarting the app requires signing in again.
- Facility wallet address, network, live gas balance and on-chain role. An unavailable balance is shown as unavailable, rather than zero.
- Real product metadata and image upload, manufacturer-only labels, authoritative chain custody, and database-backed operation receipts.
- Automatic registration, open or addressed dispatch, eligible receipt, individual sale and recall submission. Manufacturer/supplier/retailer actions use the selected facility wallet. Admin recall uses the configured network administration wallet.
- Business/facility administration uses existing protected APIs. New business accounts require a password; new facilities must match their parent account's role.
- Scan alerts and account audit entries come from the database. Demo role switching and reset controls are absent in live mode.
- Location provenance, coordinates when provided, accuracy and capture time remain in the operation record. The contract receives a bounded location description explicitly distinguishing device-reported coordinates from a profile address.

## Transaction safeguards

The server journals each request and item. An account-scoped request ID rejects changed payloads and deduplicates retries. A unique pending-product constraint prevents overlapping mobile actions on the same item. Wallet locks serialize signing across backend processes and the older web auto-execution endpoint.

Signed transaction bytes and their hash are saved before broadcast. Recovery rebroadcasts identical bytes, never signs an automatic replacement for an uncertain transaction. Two confirmations are required for completion. Restart recovery runs every five seconds without requiring an open app. Secret key fields and raw signed payloads are excluded from API responses.

The server rechecks account, facility status, role, expected history version, and contract permissions before signing. A pending/revoked/suspended wallet cannot gain approval through an operational action. A separate administrator action controls role approval.

## Validation

- Backend suite: 116 passed; two PostgreSQL-dependent tests were skipped in that general invocation. The new Enterprise PostgreSQL integration test was then run explicitly and passed.
- PostgreSQL integration covered concurrent identical requests, changed-payload conflicts, cross-account access, inactive wallets, forbidden roles, lost persistence responses, RPC response loss, multiple workers, confirmation thresholds and revocation before signing.
- Restored the prior live backup into an isolated PostgreSQL 18 instance and applied migrations twice using the migration runner. The temporary server was stopped after testing. A fresh private pre-release backup is at `C:\Users\HP\AppData\Local\Temp\smartscan-backend-release-state-20261107\before-enterprise-live-pg18.dump`.
- Enterprise: TypeScript/build and 27 tests passed. Android assembly and signature verification passed.
- Live readiness returned HTTP 200 with database, schema, rate-limit store, media store and blockchain checks successful.
- Admin, manufacturer, supplier and retailer snapshot routes returned real records without wallet secret fields.
- The installed Android WebView reached the live API, received migration 015 readiness and correctly received HTTP 401 for invalid credentials. Its sign-in screen filled the 412 × 892 viewport without horizontal overflow. Emulator System UI briefly displayed an ANR dialog; it was dismissed with Wait. Successful password sign-in on the emulator remains a user acceptance check; live API tests used short-lived test JWTs for the existing test accounts.

## Confirmed live workflow

One explicitly labelled synthetic record was created: **SmartScan connection test**, brand **INTEGRATION TEST ONLY**, serial `SS-fc699a39-6ae7-41ab-91b4-827aca717fe8`. It does not represent a physical product. Existing product custody was not changed. The test record and its audit trail were retained.

| Action | Test account | Transaction |
| --- | --- | --- |
| Register | manu1 | `0x97adf9c5e01101a2e170a5d9c5b3c42368a7d904063d870eadbdafaad73d136a` |
| Open dispatch | manu1 | `0xe214185d407e2f22a28c5b6fed7eeeaa04fa8f48a8e25de33aa428c13ba58862` |
| Receive | supp1 | `0x3a4d76233c180d370cd5af79dcc11c3cabc52492fbcd8b18d017879f32b8a8ba` |
| Open dispatch | supp1 | `0x29ecdaedaa212d4e5b42d9160d56efc34635123ea0ada6ba7723a4eb46dea1e4` |
| Receive | retailer2 | `0xecfcef7f92a4f74927b70b833111fe0560cf02763bb6aa9eed89c949e7a54356` |
| Individual sale | retailer2 | `0x7ef9a93c100987c5fc7e405e93f8995a9c1ff3e78b768690976cfdeea1921835` |

Each submission was repeated with its original request ID and returned the same operation. All six actions confirmed. The final passport showed Sold, six history entries, and the retailer's facility as custodian. Existing funded facilities supplied the gas for this test; the newly funded treasury did not need to replenish them.

## Current boundaries

This connects the current pilot to the existing shared backend; the blockchain remains Sepolia. Manufacturer serialization imports, pack aggregation, production rollout and calibrated authenticity scoring are separate work. Snapshot reads currently fetch the registry and read custody with bounded RPC concurrency; this needs indexing/pagination before large inventories. Operation history returns the latest 200 operations and a submission accepts up to 50 items. Confirmations are processed sequentially per facility wallet.

The iOS source and Codemagic configuration use the same live service. No new iOS cloud build or signed TestFlight distribution was performed in this release. A paid Apple Developer membership is still needed for TestFlight signing.
