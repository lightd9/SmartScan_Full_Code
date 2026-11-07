# SmartScan receipt and verification pilot

This implements the authorized parts of packages 1, 2, 5 and 6 from the [workflow correction plan](SMARTSCAN_WORKFLOW_CORRECTION_PLAN.md), with manufacturer serialization and unit/pack aggregation explicitly deferred. The older planning document describes the pre-release state; this record describes the deployed pilot.

## Deployment and compatibility

| Component | Release |
| --- | --- |
| API | `https://smartscan-backend-52s4.onrender.com` |
| Render service / deploy | `srv-dbgc6c6c6qcc73evtqcg` / `dep-dbnq5g2jnfac73d2oqmg` |
| Backend commit | `5647d3b45435ef7f8befe66058a323f1279705e4`, branch `release/receipt-verification` |
| Deployed at | 2026-11-07 22:15:13 UTC |
| Existing Sepolia V2 authority | `0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96`, unchanged |
| New Sepolia receipt authority | `0x3868b55f348AFADd19e4EC5672480264C6E19652` |
| V3 deployment transaction | `0xb8356d8b2a8bc17f86f5fedcd0af56d3637865835870bd5a0ab4c45ac68efa7e` |
| New-protocol cohort | New products created by `aster.test` only |
| Android | Both apps built as `1.1.0-testing`, version code 2, development signing |
| iOS | Both simulator compilations passed on Codemagic at `193685e`; no signed TestFlight release without Apple Developer membership |

Nine existing active facility wallets were provisioned on the new contract after their V2 roles were checked. The global V2 contract setting was preserved. Existing products, labels, accounts, admin access and custody history were not migrated or reset. A fresh live backup was restored locally and additive migrations 016–018 were rehearsed while preserving all 15 pre-pilot products.

The older web frontend has **not** been upgraded or redeployed in this release. Use the updated mobile apps for the V3 workflow. Backend legacy write endpoints reject V3 records. Existing V2 records retain their original contract behavior, including on-chain dispatch; that immutable behavior has not been retroactively secured by the V3 implementation.

## Handover behavior

1. The current custodian records dispatch in the database. V3 dispatch broadcasts no transaction and has no destination selector.
2. The receiver requests receipt. The current sender sees the named receiver in Handover approvals.
3. Sender approval authorizes a specific receiver, product, custody version and expiry. The integrated wallet signs an EIP-712 permit privately.
4. One receiver transaction verifies the permit and records confirmed custody. Registration, sale, recall and exceptional permit invalidation can still require their own transactions.

A missing dispatch remains a visible exception. Receipt can be requested, but sender approval is required and a past dispatch is not invented. Possession of a public QR, GPS proximity or a registered receiver account is insufficient to authorize V3 custody.

The permit includes chain/contract binding, replay protection and credential epochs. Wallet revocation/replacement and product authorization invalidation are checked. Cancellation before signing is supported. After signing, a database-only cancellation is refused: the contract authorization must expire or be invalidated. Signed payloads remain private.

Operation journals retain transaction recovery data. Confirmation checks validate a canonical block before confirming the operation. A continuous post-confirmation deep-reorganization watcher is **not implemented**. No independent security audit has been completed; this remains a Sepolia pilot.

## Consumer assessment policy

The main result is the assessment, with sale status secondary. View checks exposes findings, passed/concern/unknown states and earned points.

| Scored evidence group | Weight |
| --- | ---: |
| Blockchain identity | 25 |
| Custody consistency | 25 |
| Active manufacturer registration | 10 |
| Buyer-confirmed retailer matching confirmed custody | 20 |
| Applicable, usable purchase-location comparison | 10 |
| Available scan anomaly checks | 10 |

Policy `evidence-2`, score policy `pilot-weights-1`:

- **70–100**, with identity, custody and seller checks all passed and no concern: **Authenticity checks passed.**
- Missing evidence or an unmet required check: **More verification needed** / **Unable to authenticate yet**. A low score alone does not assert counterfeiting.
- An actual evidence concern: **Potential authenticity risk**, even if other checks earn a high score.
- Recall: **This product has been recalled**, overriding positive evidence.

The public label is **Evidence score**. These are transparent pilot weights, not a statistically calibrated probability of physical authenticity. Unknown checks earn zero; the denominator is not reduced to manufacture a high score. Production release and exact packing evidence are explicitly unavailable and do not count toward this version's score.

The retailer comes from confirmed custody and is matched separately to the buyer's declared seller. This is buyer-supplied corroboration, not independent proof of purchase. Coordinates are compared only for a buyer checking at the purchase store, with sufficiently fresh and accurate device evidence. Delivery, checking after leaving, denied GPS, profile addresses and unavailable coordinates do not receive a distance mismatch penalty. V3 public history minimizes precise device locations; connecting map lines are not an observed travel route.

Repeated checks from the same network observer do not alone trigger the provisional frequency concern. The frequency rule requires at least ten checks from at least three observer hashes within ten minutes. Logistics observations are excluded. These provisional network and location signals can still produce false positives and require evaluation before broader use.

Reassessment after purchase confirmation reuses the original observation identifier. It does not inflate the consumer scan count.

## Sessions and reports

Enterprise restores sessions with revocable refresh credentials and an absolute 30-day lifetime. Access tokens remain in memory. Native refresh credentials use Android Keystore/iOS Keychain through the secure-storage plugin. Browser previews use Secure, HttpOnly cookies with origin/header validation. Refresh failure caused by connectivity does not log the user out; explicit logout revokes the session. The HTTPS preview rewrites the cookie path to its API proxy prefix.

Consumer reports can be explicitly submitted to the server and return a case reference. Drafts remain local until submitted. A saved draft retains its submission request ID; retries update the same local record when a server receipt arrives. Administrators can review cases with an audit trail and version-conflict handling. Reports are not silently uploaded or treated as proven counterfeit findings.

## Validation evidence

- Contract suite: 36 passed, including 9 V3 authorization, replay, expiry, invalidation, revocation and replacement tests.
- Backend suite with isolated PostgreSQL and local contract RPC: 125 passed, none skipped. Final targeted app/anomaly integration: 46 passed.
- Enterprise: 30 tests passed; TypeScript, Vite and Android debug build passed.
- Consumer: 15 tests passed, including draft retry/case deduplication; Vite and Android debug build passed.
- Live pilot: four new synthetic V3 products registered. Transfers through manufacturer, supplier and retailer completed, followed by a selected-item sale.
- Live assessment: before retailer confirmation `INCOMPLETE`; correct retailer `VERIFIED`, 90/100; different seller `CONCERN`; existing V2 recalled sample `RECALLED`; reassessment reported `replayed: true`.
- Android emulator: native login, minimize/resume, force-stop/relaunch and explicit logout/relaunch verified. Native Consumer displayed the live 90/100 passing result after retailer confirmation.
- WebKit: Secure/HttpOnly cookie scope, reload, a new browser context, network-failure recovery and explicit logout verified. Both apps fit 320, 393, 768 and 960 CSS-pixel viewports; Consumer retailer confirmation and mismatch states passed.
- Report browser regression with a mocked server: failed submission, offline draft, reopened draft and successful retry retained one request ID and one stored case.
- Codemagic iOS simulator checks passed for Consumer (`6aefa8c19b55daafa6fb9c51`) and Enterprise (`6aefa8c17ef104892ebe6c5d`). These are unsigned simulator artifacts, not installable iPhone builds.

## Tester handoff

The versioned local pack is `C:\Users\HP\Desktop\SmartScan Workflow Tester Pack - 2026-11-07`. It contains both APKs, private tester credentials, four new V3 sample labels, an existing recalled V2 sample, an unknown identifier, printable labels, checksums and a guide. The earlier tester pack is preserved. This package contains private credentials and must not be committed or published publicly. It has not been sent to testers.

For iPhone browser testing on the same Wi-Fi, the local HTTPS previews are Consumer `https://192.168.0.4:5177` and Enterprise `https://192.168.0.4:5181`. These previews are a temporary test route, not the native iOS distribution plan.

## Work still deferred

Manufacturer production/serialization connectors, exact pack membership/splits, individual loose-unit resolution through manufacturer codes, production security review, calibrated scoring evaluation, deep-reorganization recovery and signed iOS distribution remain separate work. Do not represent this pilot as ready for national production deployment.
