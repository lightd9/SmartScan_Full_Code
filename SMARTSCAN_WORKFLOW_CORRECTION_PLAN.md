# SmartScan workflow correction and completion plan

Prepared 7 November 2026 as a planning document. The user subsequently authorized packages 1, 2, 5 and 6 and deferred manufacturer serialization and pack relationships. See the [pilot release record](SMARTSCAN_WORKFLOW_RELEASE_2026-11-07.md) for the implementation and validation state. The audit below preserves the position at planning time.

This turns the outstanding work in [the improvement roadmap](SMARTSCAN_IMPROVEMENT_PLAN.md) into concrete delivery packages. It also corrects the impression that connecting the apps to the database and wallets completed the proposed workflow. The current tester package validates the existing V2 workflow; it does not validate the proposed replacement.

## 1. Verified current position

| Requirement | Current implementation | Remaining work |
| --- | --- | --- |
| Business accounts and integrated wallets | Live username/password accounts, encrypted facility wallets, role checks and automatic signing | Preserve these; distinguish an authenticated business approval from the backend's ability to sign. |
| Dispatch without a blockchain transaction | **Not implemented.** Enterprise calls `dispatchProduct`; the deployed V2 contract requires it before receipt | Off-chain dispatch records and sender authorizations, plus a new receipt-capable contract/adapter. |
| Confirmed receipt on-chain | Implemented under V2, after on-chain dispatch | One receipt transaction must verify the sender's off-chain authorization and the actual receiver. |
| No compulsory dispatch destination | The selector defaults to Open, but optional named destinations remain | Simplify the normal dispatch screen; establish the actual receiver through a controlled handover. |
| Receipt when dispatch was missed | Rejected by the current app and contract | A pending receipt request with sender approval or verifiable shipment authorization; no invented past event. |
| Selected-item sale | Implemented for separately registered records | Extend it to actual units separated from a carton without selling siblings. |
| Retailer identified from custody | The assessment derives the current custodian from confirmed history | Resolve the actual unit's latest custody after splits; compare the claimed seller separately. |
| Transaction location | Enterprise attempts device capture and records accuracy/source/time, with labelled profile/unavailable fallback | Consistent structured history across clients; purchase context, visibility controls and source-aware comparisons. GPS is not guaranteed or exact. |
| Manufacturer API/CSV serialization import | Not implemented | Authenticated, idempotent production/packing import and identity resolution. |
| Unique units inside a particular carton | Not implemented; `bottle`/`carton` is currently a packaging-kind field | Exact, versioned membership, activation, splitting, partial receipt and reconciliation. |
| Consumer loose-unit lookup | Current parser accepts SmartScan identifiers/QR payloads | Existing manufacturer serialized codes and barcode-plus-unique-serial resolution. |
| Evidence/metrics | Identity, available custody consistency, recall and scan anomaly findings are connected; score is null | Production, packing, seller and purchase-location evidence; expanded anomaly rules and evaluation. |
| Consumer reports | Saved locally on the device | Explicit server submission, acknowledgement, review and investigation cases. |

Source evidence: [V2 contract](smartscan-smartcontract-solidty/contracts/IdenteefiV2.sol), [enterprise operations](smartscan-backend-node/enterprise.js), [snapshot/routes](smartscan-backend-node/enterprise-routes.js), [assessment policy](smartscan-backend-node/assessment.js), [mobile rules](smartscan-mobile-enterprise/src/domain/rules.ts), [dispatch review](smartscan-mobile-enterprise/src/features/Review.tsx), [location capture](smartscan-mobile-enterprise/src/platform/location.ts), [consumer reports](smartscan-mobile-consumer/src/components/ReportTab.jsx).

The live backend release and tester setup are documented in [the connection record](ENTERPRISE_LIVE_CONNECTION_2026-11-07.md) and [tester handoff](TESTER_HANDOFF_2026-11-07.md). Web source changes that have not been independently deployed/verified must not be reported as live merely because they exist locally.

## 2. Proposed target workflow

The working recommendation follows the requested model: **dispatch approval off-chain; confirmed custody receipt on-chain**. Periodic blockchain commitments remain a future scale option, not a silent replacement for this model.

| Step | What the business does | What SmartScan records | Blockchain effect |
| --- | --- | --- | --- |
| Produce | Manufacturer reports successfully produced/released unit identities | Validated issuer/product/serial/lot records and source evidence | No transaction for each imported bottle by default. |
| Allocate labels | Manufacturer reserves SmartScan carton identifiers | Reserved, issued, voided and reprint records | A printed/reserved label alone does not mean an authentic or activated product. |
| Pack and activate | Packing equipment or an operator reports the exact contents of each carton | Versioned contents manifest, closed/activated status and evidence reference | Register the logistics identity and selected contents commitment under the approved proof model. |
| Dispatch | Current custodian approves release for transport; destination can remain open | An immutable operational event and off-chain authorization | **No dispatch transaction and no dispatch gas.** |
| Bind the receiver | Actual receiver is identified at handover or through an authenticated shipment instruction | Receiver-bound authorization, tied to the approved stock/version | Off-chain signature only. |
| Receive | Authorized supplier/retailer confirms actual receipt | Durable receipt operation, discrepancies and proof progress | One custody transaction for the accepted transfer scope verifies sender authorization and receiver eligibility. |
| Split and distribute | Supplier identifies the units/subcontainers going to each retailer | Removal from the old parent and new movement/parent associations | Only the transactions required by the selected split/contents model; this must be costed explicitly. |
| Sell | Retailer selects a unit it holds | A unit-specific sale | Preserve explicit sale proof under the selected adapter; no sibling sale. |
| Verify | Consumer scans the unit's existing identifier or enters its unique serial | Evidence assessment and a deduplicated scan observation | Read-only verification; scanning never transfers custody or marks a sale. |

“Receipt-only” describes **handover transactions**, not the entire product lifecycle. Registration/activation, sale, recall, certain split operations and authorization cancellation may still require transactions.

### Open dispatch and omitted dispatch

Open destination must not mean that anybody holding a photograph of the public QR can take stock.

- Normal dispatch records the sender's approval. At actual handover, an authorized sender-side user or authenticated shipment integration binds the receiver. A generic open dispatch signature is insufficient to claim custody.
- If no usable sender authorization exists, the receiver creates **Request receipt approval**. It stays pending with the previous confirmed custodian until approval is obtained.
- Approval can be automatic only when backed by an existing authenticated, receiver-specific shipment instruction. A registered account, a nearby GPS point or a public QR is not sufficient.
- A manual pilot can use a sender approval inbox; an ERP connector can remove that extra manual step later. A private handover mechanism needs expiry, receiver binding and replay protection and must not be printed on the public product label.
- Preserve the actual times of request, approval and receipt. Record “dispatch not recorded” where applicable; do not backdate an invented dispatch to make the history appear complete.

### What the user sees

- Dispatch: **Dispatch recorded** when the operational record and required authorization are durable; no blockchain spinner or fake transaction hash.
- Receipt without approval: **Waiting for sender approval**; not “Received.”
- Receipt submitted: **Receipt submitted**, followed by **Custody confirmed** after the configured chain confirmation checks.
- Normal dispatch has no compulsory destination picker. Receiver identity is confirmed in the handover/approval step instead.
- Keep direct receipt from a product passport, scan/review/confirm flows, manufacturer-only label export and single-item sale selection.

## 3. Delivery packages and completion gates

| Order | Package | Concrete deliverables | Must pass before the next dependent release |
| --- | --- | --- | --- |
| 1 | Version and authority boundary | Per-record protocol/contract identity; legacy/new adapters; shared operation/evidence schemas; feature flags and migration rehearsal | Existing labels, V2 products, accounts and wallets still resolve correctly. New and old paths cannot both control one product. |
| 2 | Correct handover for individual registered items | Off-chain dispatch journal, receiver approval inbox, sender permits, receipt transaction, cancellation/expiry handling, new contract tests and mobile states | Dispatch broadcasts zero transactions; authorized receipt broadcasts one; missing dispatch stays pending until approved; copied QR cannot claim custody. |
| 3 | Manufacturer identities and imports | Product/lot/unit/container records, namespaced identifier aliases, authenticated API and CSV preview/commit, rejection and reconciliation tools | Duplicate retries do not duplicate units; issuer isolation, leading zeros, significant case and withdrawn/rejected production all behave correctly. |
| 4 | Exact packing and distribution | Carton label allocation/activation, membership versions, packing import/station, splits/repacking, partial receipt and unit sales | The 24-unit/two-retailer scenario below passes, including concurrent and failed operations. |
| 5 | Consumer evidence and investigations | Loose-unit resolver, seller/purchase context, location findings, unit/carton evidence, shared reports/case review, shadow metrics | Clients agree on the same evidence; missing evidence remains unknown; recalls dominate; reports have genuine submission receipts. |
| 6 | Controlled live pilot | Reviewed proof adapter, backed-up additive migrations, allowlisted pilot cohort, native/PWA acceptance, updated tester kit and observability | End-to-end, recovery, authorization and compatibility gates pass. Clearly publish which requirements are live. |

Packages 3 and the design work for 5 can run alongside package 2 once their interfaces are agreed. Package 2 can demonstrate the dispatch correction without pretending that carton aggregation or manufacturer integrations already exist. No package is “complete” until its stated gate is evidenced.

### Package 1: preserve existing authority

The deployed V2 contract is not made receipt-only by editing Solidity in this repository. Its current `confirmDelivery` requires the prior chain dispatch. Removing just the UI/backend dispatch call would strand receipts.

Use a separately versioned contract and API adapter for the new pilot records. Retain V2 for existing products until an explicit migration procedure is separately designed and tested. Do not change a global contract address and make old labels appear unregistered.

The resolver must bind record identity to its approved chain/contract/protocol. Clients accept only supported authorities, not an arbitrary contract supplied in a scanned code. Upgrade all relevant readers, indexers, history consistency checks, wallet-role provisioning and write paths, including the older web auto-execution endpoint. Unsupported old app versions must not write new-model products.

Reuse existing integrated wallets where appropriate and grant their roles on the new contract through the approved administrative process. A role on V2 does not automatically exist on a new deployment. Preserve admin credentials and the current tester dataset; use a separately labelled cohort for new-flow testing.

### Package 2: authorization and durable processing

Use a typed sender permit, with automatic wallet signing following an authenticated business approval. Bind at least:

- Subject identity and transfer scope; contents commitment/version when applicable.
- Sender wallet, bound receiver wallet and expected custody version.
- Unique authorization/nonce, expiry, chain ID and verifying contract.
- Applicable credential/authorization version needed for revocation and wallet replacement.

Validate active roles, current custody, business authority, unconsumed nonce, expiry and versions before acceptance. The chain must enforce the receipt conditions the product claims it enforces. Reject self-receipt, incompatible roles, signature alteration and authorization for another chain/contract.

Define cancellation/revocation explicitly: a database status change alone cannot revoke a still-valid permit that someone already possesses and can submit directly. Include short validity and a contract-enforced nonce/epoch/invalidation mechanism; document any exceptional gas cost.

Separate operational state from proof state. Journal requests before signing/broadcast, preserve exact retry payloads, serialize conflicting product/contents changes and retain signed transactions across restart. Track canonical blocks and reorg recovery, rather than treating a timeout or one observed receipt as irrevocable finality. Do not allow a proof-pending transfer to become simultaneously transferable by both parties.

### Packages 3–4: identity, labels and real carton membership

Keep the existing database. Add explicit product type, lot, unit, identifier alias, container, production event, membership event and import-job records. Authentication binds imports to the manufacturer; clients cannot choose another issuer in their payload to bypass ownership.

A valid loose-unit key is an issuer/product/unique-serial identity. An ordinary EAN/UPC or GTIN commonly identifies a product type, and a lot identifies a production batch; neither is assumed unique per bottle. Preserve original formatting and issuer-specific serial rules.

Provide versioned production and packing CSV templates and an API using the same validator. Stage rows, display accepted/rejected/unresolved results, then commit explicitly. Enforce source-event IDs, payload digests, duplicate handling, ordering and corrections. An API schema can be developed with labelled synthetic fixtures before partner access; a functioning real connector cannot be claimed until verified partner samples and mappings exist.

For labels:

- SmartScan can reserve carton IDs and generate label assets; a manufacturer can print them with its existing equipment or use SmartScan-supplied stickers.
- Activate a carton only after production eligibility and its exact contents are reconciled. Track wasted/voided/reprinted labels and permissions.
- Prefer an existing serialized DataMatrix/QR/barcode on each unit. Add a unique SmartScan unit QR only where necessary. OCR/manual entry should confirm uncertain characters.
- A shared carton QR on bottles is only optional context. It does not replace a unique unit identity or create membership automatically.

Membership must name exact child IDs, support removals/repacking and prevent cycles or simultaneous active parents. Never infer carton contents from a batch total or a serial interval without explicit producer evidence. Changes invalidate affected transfer authorizations.

**Acceptance scenario:** carton C101 has U001–U024. After supplier receipt, U001–U012 go to retailer A and U013–U024 to retailer B. U015 resolves to B following B's confirmed receipt. Selling U015 leaves U014/U016 unchanged. Moving the old carton later cannot move separated units. Missing units remain unresolved during partial receipt.

**Proof/cost boundary to settle in design:** a manifest hash proves commitment to submitted contents, not that those contents were physically packed or that an off-chain membership ledger never double-assigned a unit. Choose and document which membership/split invariants are enforced by the contract and which rely on an auditable backend ledger. Strong on-chain per-unit enforcement can use batched transactions but still incurs per-unit computation/storage; do not promise constant cost or national scalability from one carton QR. No unbounded container loop may block receipt or splitting at realistic pack/pallet sizes.

### Package 5: metrics and consumer interpretation

Keep one versioned backend assessment contract. Separate **identity evidence, traceability, anomaly findings and safety**. Each finding includes source, scope, timestamp, reliability limitations and an actionable explanation.

| Evidence group | Planned checks | Interpretation and safeguards |
| --- | --- | --- |
| Issuer/identity | Approved issuer, correct product namespace, recognized unique serial, identifier/signature validation | A copied valid identifier can pass. An unsupported manufacturer or missing record is not automatically counterfeit. |
| Production | Authenticated release, rejected/withdrawn state, lot/serial consistency | Import availability and source freshness must be explicit. |
| Packing | Actual membership at the relevant time/version, removal/split history, manifest consistency | A matching copied code pair remains copyable; missing membership is unknown. |
| Custody | Authorized sender/receiver, valid versions, complete confirmed sequence, unresolved receipt disputes | A self-reported scan cannot overwrite custody. Legacy and new histories need different transition validators. |
| Seller | User-selected registered business/facility versus the unit's last confirmed retailer; unregistered seller captured as a claim | Match stable identities, not only business-name text. If branch is unknown, say so and show the available address without inventing one. |
| Location | Purchase/store context versus relevant custody location; distance, time, accuracy and delivery context | Asking where the user bought it is different from locating their phone now. A scan 100 km away after travel is not sufficient evidence of a counterfeit. |
| Scan anomalies | Unusual concurrent locations, frequency, repeated activation, purpose-aware duplicate patterns | Deduplicate events; calibrate for unit/container scope, logistics scans and ordinary post-purchase use. Prevent report/scan spam from determining business reputation. |
| Lifecycle/safety | Sale, authorized return/quarantine, recall scope and reliably sourced expiry | A genuine item may be recalled/expired; safety warnings cannot be cancelled by positive identity checks. Repeated scans after sale are normal. |
| Inspections/cases | Acknowledged reports, corroboration, authorized inspection findings, resolution/correction | Keep allegations separate from confirmed outcomes; support review and audit history. |
| Optional physical evidence | Concealed activation secret, tamper evidence, secure tag, label-field inconsistency | Category-specific options after feasibility testing; package photos are identification assistance, not proof of contents. |

Show evidence coverage separately from any future numerical index. Avoid counting barcode, serial, brand and carton fields from one source as four independent proofs. Denied GPS, absent partner data or failed providers remain unknown/unavailable. Do not renormalize limited evidence into an apparent 100% authentic result.

Develop candidate weights in **shadow mode** using independently labelled pilot cases, including copied valid codes, legitimate travel, false reports, returns and stale data. Measure false positives, missed known counterfeits, coverage and calibration by category/partner. Public scores remain null until there is a defensible policy and acceptance evidence; no invented universal percentages.

Location history uses immutable event snapshots: source, coordinates if available, accuracy, captured time and server-received time. Geocoded addresses are approximate. Keep unmappable events in the journey list. Connect observed custody points in order without presenting the line as a measured transport route. For the new model, restrict precise coordinates and publish minimized proof material; existing public V2 locations cannot be retroactively removed.

Reports require an explicit Submit action, idempotent server receipt/case ID and clear offline-draft status. Do not silently upload previously saved local reports. Case access, evidence retention and outcomes need role-based controls.

## 4. Required acceptance matrix

| Scenario | Required observable result |
| --- | --- |
| Dispatch with a funded or unfunded operational wallet | Operational dispatch can be recorded without broadcasting a transaction or consuming dispatch gas; off-chain signing remains available. |
| Normal authorized receipt | Exactly one receipt transaction; sender approval and receiver match verified; custody changes only after the applicable confirmation checks. |
| Receipt before sender dispatch/approval | Pending request; no custody change; approval later produces a truthful exception trail. |
| Copied public QR / unrelated registered business | Lookup allowed within visibility rules; custody claim denied without valid receiver-bound authorization. |
| Two receivers, duplicate taps, timeout/restart | At most one accepted transfer; exact retries return the same operation; no double sale or replacement signing after an ambiguous response. |
| Expired/cancelled permit, revoked role or replaced wallet | Rejected according to contract-enforced rules, including direct contract submission. |
| Wrong chain/contract, tampered recipient, stale contents | Rejected; not interpreted as a normal retry. |
| Partial receipt, split, recalled contents | Exact units accounted for; discrepancies unresolved; recalled units not released through a split. |
| Manufacturer re-import and cross-issuer serial collision | Retry-safe results and correctly separated issuer namespaces. |
| Consumer after split/sale/recall | Correct unit retailer and separate lifecycle/safety findings; sibling state unchanged. |
| Missing GPS, remote scan, geocoder failure | No invented location or automatic authenticity penalty; available history remains visible. |
| Existing V2 code and old client | Legacy reads remain valid; unsupported new writes are refused clearly. |
| Report retry or offline submission | One acknowledged server report or an explicitly unsent draft. |

Validate at domain, database-concurrency, contract and API levels, then run the same representative cases through Enterprise, Consumer and affected web flows. Include native background/resume and weak connectivity. Passing a demo simulation alone is not the live release gate.

## 5. Migration and release controls

1. Preserve all existing code edits, tester accounts, funded wallets and labelled test products. Make a private backup and rehearse additive migrations/restoration in isolation.
2. Introduce versioned reads and feature-gated new writes. Do not rewrite historical dispatches, relabel V2 records as the new protocol or manufacture unit children for old carton records.
3. Test the new contract locally and on Sepolia with a separate labelled cohort. Maintain an explicit contract registry and verified role provisioning.
4. Release backend readers before enabling new writes, then compatible web/mobile readers and workflow screens. Keep old clients safe during coexistence.
5. Run the acceptance matrix and obtain an independent contract/security review before production use. Pilot acceptance is not a claim of government approval or nationwide readiness.
6. Produce a release matrix showing each capability as planned, implemented locally, tested, deployed and verified on-device. Update the tester guide to distinguish legacy records from the new cohort.
7. Roll back by stopping new-model writes and preserving pending operation evidence. A database restore cannot undo a blockchain transaction. Reconcile external effects before reopening writes.

Continue using Render for the API and the current PostgreSQL database. Vercel can host the web previews. Native apps use those services; iOS/TestFlight signing remains a separate Apple membership requirement.

## 6. Decisions to resolve before dependent implementation

| Decision | Recommended starting position | When it is needed |
| --- | --- | --- |
| Proof model for this correction | Off-chain sender approval plus a receiver transaction that enforces custody; keep periodic commitments as a later measured alternative | Before the new contract/API design is frozen. |
| Receiver binding with open dispatch | Sender approval inbox for the manual pilot; authenticated shipment instructions can later automate it | Before handover implementation. It adds an approval step when no prior recipient authorization exists. |
| Membership enforcement/cost | Explicitly design and benchmark the split/content proof model; disclose any backend trust boundary | Before carton/split contract implementation, not after committing to nationwide cost claims. |
| First manufacturer/category | One willing partner with actual unit and, preferably, aggregation exports | Before claiming a real connector or production pilot. Synthetic fixtures can support development meanwhile. |
| Public score | Explained findings and coverage first; numerical index only after shadow evaluation | Before exposing any numerical authenticity claim. |

These are proposed defaults and gates, not a request to start now. The next implementation authorization should name the agreed delivery package and any changed decision. **For this turn, only this plan and the roadmap status are updated.**
