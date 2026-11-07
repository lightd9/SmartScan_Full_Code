# SmartScan implementation improvement plan

Prepared 7 November 2026, following the [authentication architecture review](SMARTSCAN_AUTHENTICATION_REVIEW.md).

**Status updated 7 November 2026: selected correction packages deployed as a controlled Sepolia pilot.** The user subsequently authorized packages 1, 2, 5 and 6, with manufacturer serialization and exact pack relationships deferred. New allowlisted products use off-chain dispatch and receiver-bound on-chain receipt. Consumer seller/location checks, a transparent evidence score, server reports and resumable Enterprise sessions are implemented. Existing V2 products remain under their original contract. See the [release record](SMARTSCAN_WORKFLOW_RELEASE_2026-11-07.md) for actual deployment, validation and remaining boundaries. The [workflow correction plan](SMARTSCAN_WORKFLOW_CORRECTION_PLAN.md) retains the original gap audit and acceptance gates; not every roadmap requirement is complete.

## 1. Intended outcome and implementation order

SmartScan should explain what is known about a particular product, where that evidence came from, which checks could not be performed, and what warrants concern. A registry match or a blockchain receipt must not be presented as proof of a bottle's physical contents.

Recommended order:

| Milestone | Deliverable | Dependency / exit gate |
| --- | --- | --- |
| M0 — Correct current results | Correct lifecycle interpretation, truthful verdicts, explicit unavailable states | Can start immediately; cross-client regression cases pass. |
| M1 — Shared assessment service | One backend evidence policy used by consumer and web; existing scan flags integrated | M0 semantics agreed; clients give the same assessment for the same evidence and policy. |
| M2 — Manufacturer and identity integration | Unit/lot/container model, authenticated production imports, identifier resolution | Representative partner data; retry-safe imports and reconciled identities. |
| M3 — Packing and authorized custody | Exact carton membership, splits, partial receipt, safe missing-dispatch workflow | M2; domain and enterprise demo validation, plus a proof-architecture decision before live writes. |
| M4 — Expanded metrics and investigations | Seller/purchase context, stronger anomaly analysis, shared reports, shadow scoring | M1; unit-specific checks require M2/M3. No public percentage without validation. |
| M5 — Live services and proof integration | Selected proof adapter, authorized operation processing, controlled migration | M2/M3 and security review; staging reconciles operations and proofs. |
| M6 — Partner pilot and rollout decision | Measured usability, detection quality, integration effort, cost and governance | M0–M5 for the chosen pilot scope; demonstrated acceptance criteria. |

M2 partner discovery can proceed alongside M0/M1. M4 rule design can proceed alongside M3. A real unit-to-carton or seller match cannot be enabled until its underlying data exists. Use these exit gates instead of calendar promises until team capacity, partner exports and hardware needs are known.

## 2. Recommended design decisions

These are proposed defaults. Record the final proof and partner decisions before the dependent implementation work; no decision is needed to begin M0.

| Question | Recommended default | Benefit and remaining cost |
| --- | --- | --- |
| What identifies one bottle? | Manufacturer/product/unique-unit serial, resolved to a stable SmartScan ID | Reuses existing serialization; requires an authentic issuer feed and documented identifier rules. |
| Must SmartScan print every label? | SmartScan can allocate and control carton IDs while manufacturers print them; accept aliases for existing unique logistics IDs | Reduces line disruption. Allocation, activation, waste and reprints still need reconciliation. |
| How does a consumer scan a loose unit? | Read its existing serialized code; otherwise barcode plus OCR/manual unique serial; offer unique SmartScan unit QR where needed | Avoids requiring access to the outer carton. Ordinary barcode plus lot is only product/lot evidence. |
| Can carton QR copies go on bottles? | Only as optional context combined with a unique unit serial and recorded membership | Shared carton QR alone cannot support individual sales, clone detection or retailer provenance. A valid copied pair remains copyable. |
| Can receipt repair an omitted dispatch? | Create a pending receipt request, then obtain sender approval or verifiable shipment authorization | Preserves usability without giving any registered scanner authority to claim stock. Adds exception handling. |
| Must a destination be chosen at dispatch? | Keep the destination optional initially; bind the receiver through controlled authorization before custody changes | Preserves open routing. Public QR possession alone is insufficient authority. |
| Should we delete dispatch location? | Separate optional destination selection from origin evidence; retain useful, source-labelled origin capture | Supports provenance without imposing a destination. Device coordinates are estimates, not exact proof. |
| Should blockchain be removed now? | Keep V2 for existing records; separate assessment and operations from the proof adapter | Allows current fixes immediately and avoids a premature migration. |
| What proof mode should the new model use? | Evaluate signed operational records with periodic externally verifiable commitments as the preferred pilot architecture | Amortizes publication cost but needs retained event data/proofs and trustworthy event authorization. Receipt-based on-chain custody remains an alternative. |
| Should consumers see an authenticity percentage now? | Show explained findings and evidence coverage first; evaluate numerical scoring in shadow mode | Avoids an unsupported probability claim; requires pilot ground truth before public scoring. |

## 3. M0 — Correctness before new features

### Work

- Correct consumer stage mappings in `smartscan-mobile-consumer/src/api/verify.js` and `src/utils/product.js`: V2 Delivered=3, Sold=4, Recalled=5. History action IDs are a separate enum and must not be interpreted as stages.
- Review primary and fallback verification paths together. A cached registration must not override a newer authoritative recall or contradictory current state. Preserve source, contract/network and last-confirmed timestamp. Failure to retrieve a record is different from a successful authoritative lookup returning no record.
- Audit SS-UUID case handling and future native-identifier parsing. Do not uppercase or strip significant characters before a case-sensitive lookup. Keep existing issued IDs resolvable.
- Replace unsupported conclusions such as “authentic” from registration alone and “counterfeit” from registry absence. Use findings such as “Registered identity found,” “Not found in available records,” “Verification unavailable,” and “Supply-chain concern,” with separate safety warnings.
- A sold item remains verifiable. Ordinary post-purchase rescans do not imply counterfeiting and do not create another sale. Expiry/recall needs prominent guidance even when identity checks pass.
- Preserve current location capture improvements, open dispatch selection and individual-item sales. New work must not revive placeholder warehouse locations or apply current profile addresses to past events.

### Exit criteria

Cover all V2 stages, stage/action distinction, sold-and-recalled history, invalid code, successful lookup with no record, network failure, stale fallback, mixed-case issued identifiers and authority precedence. Web and mobile wording must not contradict the same authoritative state. Existing enterprise demo fixtures must remain visibly demo data.

**First implementation package:** consumer verification fixes, reusable lifecycle/assessment fixtures, explicit source/unavailable fields, and corresponding result copy. No contract changes are required for this package.

## 4. M1 — One assessment service for every client

### Work

- Extract assessment rules from route/UI-specific logic into a backend module. Keep adapters for V2 chain reads, registry data and scan monitoring. Client helpers render the response; they do not independently invent a score.
- Add a versioned assessment endpoint and contract. Keep current endpoints compatible during migration; an adapter can expose existing evidence before manufacturer integration exists.
- Wire consumer scanning to existing `/scan-events` functionality and consume the resulting flags through the shared assessment response. Coordinate assessment and event recording so rendering, refresh and network retries do not create duplicate scans.
- Use a server-enforced event/idempotency key, scan purpose, subject scope and trustworthy server receipt time. Keep device capture time separately. A public anonymous submission is lower-trust evidence than an authenticated logistics operation.
- Adapt old and new transaction-location formats into structured snapshots: coordinates, accuracy, source, capture time and original text. Parse known labelled strings explicitly; preserve unknown strings as unparsed. Address geocoding produces an approximate point, not measured GPS.
- Expose recorded custodian identity and historical location independently from current profile details. Missing coordinates must not erase the custody event.
- Distinguish a complete assessment from a partial one when monitoring or an evidence provider is unavailable. Retain the existing monitoring-unavailable warning rather than silently treating that check as passed.

### Exit criteria

Shared fixtures produce identical findings in web and mobile. Retrying one scan inserts one event. Distinct legitimate scans remain separate. A failed risk service gives an explicit unknown/unavailable check. A denied location permission does not reduce the user's result as though suspicious activity occurred. No client displays a live numerical score based on local constants.

## 5. M2 — Manufacturer integration and canonical identities

### Data model

Extend the existing persistence layer additively; a database replacement is not part of this plan.

| Record | Required meaning |
| --- | --- |
| Organization and facility | Verified business identity, role, issuer permissions, facility affiliation and address history; support unknown branch explicitly. |
| Product type and production lot | Product/SKU/GTIN, issuer, lot reference, production/release information and applicable expiry metadata. A lot is not a unit. |
| Unit and external identifier aliases | Stable internal identity plus issuer/product/native serial namespace, original formatting and identifier scheme. |
| Container | Unique logistics identity, label allocation/activation state and optional manufacturer logistics alias. |
| Aggregation event | Parent, exact children, add/remove action, authorized actor, membership version, event time and correction reference. Support carton/pallet nesting without cycles. |
| Business event | Production, release, pack, transfer, sale, return, recall or correction; actor, authorization, subject/content version and separate event/received/proof times. |
| Location snapshot | Immutable source/coordinates/accuracy/address/time evidence associated with an event; visibility rules separate from business profile data. |
| Operation and proof receipt | Idempotency key, expected version, processing status, signer intent and proof status/reference. Operational acceptance and blockchain finality are separate states. |
| Assessment and investigation | Versioned findings/reasons, relevant evidence references and case disposition; public and restricted views. |

Keep production status, container contents, custody, safety and proof progress separate. “Printed,” “released,” “received,” and “confirmed on-chain” do not mean the same thing.

### Connector deliverables

1. Obtain an actual production export, an aggregation export if available, identifier documentation, reject/rework examples and packing-line throughput. Establish whether every unit is uniquely serialized. A statement of total batch quantity is insufficient.
2. Provide versioned CSV templates and an authenticated API using the same validation pipeline. Minimum production data: source event ID, issuer/product identity, unit serial, lot, disposition and timestamps. Minimum packing data: unique container, exact unit identifiers and membership/action version.
3. Scope credentials to the manufacturer; require authorization to submit or correct its records. Use idempotency keys and payload digests; reject the same key with a different payload. Preserve original records, submission history and source provenance.
4. Stage imports for preview/validation/reconciliation. Report accepted, rejected and pending rows with explanations. An unresolved unit must not activate a purportedly complete carton. Recovery retries only the unresolved work.
5. Support withdrawn/rejected units, duplicate serials, serial reuse rules, corrected packing, leading zeros, issuer-specific case rules and delayed messages. Never infer exact packing from a serial interval without an explicit guaranteed aggregation record.
6. Resolve supported SmartScan QR, GS1 serialized DataMatrix/QR and native manufacturer identifiers through one resolver. Add manual/OCR fallback with user confirmation of uncertain characters. Never merge two issuers because they used the same serial text.

### Exit criteria

A repeated file/API request does not create duplicate units or events. A tenant cannot register another manufacturer's products. Two manufacturers can legitimately use the same serial text. Rejected production cannot become saleable through an import retry. Missing aggregation is reported as missing, not filled with assumed carton membership. The consumer can look up an imported loose unit without its outer carton.

## 6. M3 — Packing, distribution and authorized receipt

### Proposed end-to-end workflow

1. **Allocate:** SmartScan reserves carton IDs for an authorized manufacturer. Printing a label alone confers no produced/packed/verified status.
2. **Produce/release:** Import successfully produced and released unit identities. Quarantine rejected, inconsistent or unresolved entries.
3. **Pack/activate:** Import existing packing events or scan units at a packing station. Associate exact unit IDs with the carton, reconcile contents, then close a version of that carton. Use existing aggregation equipment where available; reserve manual packing for appropriate volumes.
4. **Dispatch authorization:** The current custodian approves a handover through its account/ERP. The eventual receiver is bound by an authenticated delivery authorization. An initially open destination remains possible without making the public QR a claim credential.
5. **Receive:** Verify sender authority, receiver eligibility and content/custody version before accepting actual received contents. Missing dispatch creates a pending request. Discrepancies go into an exception queue; the app does not invent a historical dispatch or overwrite confirmed custody.
6. **Split/repack:** Remove specifically identified children from the old parent and assign new container/movement relationships. Preserve historical membership. Never move every original child just because the former carton moves again.
7. **Retail/sale:** Record custody for the actual received units, then sell selected units only. A carton sale is an explicitly confirmed contents operation. Define authorized return/quarantine/release paths before accepting live returns; V2 does not implement a general return transition.
8. **Consumer lookup:** Resolve the unit, its production and packing evidence, and its latest confirmed unit custodian. Ask for seller/purchase context when useful. A scan alone never changes custody or sale state.

Example acceptance scenario: carton C101 contains U001–U024. A supplier receives it, sends U001–U012 to retailer A and U013–U024 to retailer B. Scanning U015 identifies B after B's confirmed receipt. Selling U015 changes neither U014 nor U016. Moving C101 later cannot move already removed units.

### Authorization and concurrency requirements

- An off-chain handover authorization binds actor, subject, contents version, expected custody version, receiver or controlled receiver-binding mechanism, nonce and expiry. An on-chain variant also binds chain and contract. Preserve business approval separately from the backend's automatic signing.
- Sender consent cannot be manufactured by the receiving account. Revoked credentials, expired/replayed authorizations and stale membership must fail safely. Registration with SmartScan is not permission to receive arbitrary stock.
- A unit cannot be actively packed in two parents or transferred to two custodians. Validate quantities against identified contents. Changing an authorized contents version invalidates or explicitly replaces the authorization.
- Partial receipt leaves absent/disputed units in a clearly recorded unresolved state. It must not mark the full carton received. Use transactional updates and expected versions; for multi-step/external writes, expose progress and reconcile failures without duplicating effects.
- Support offline drafts and captured evidence where appropriate, but keep custody pending until the server validates authority and versions. Store capture, server receipt and proof times separately; do not backdate a confirmed event to conceal a delay.

### Enterprise deliverables and exit criteria

Extend `src/domain/types.ts`, domain rules and the service boundary with pack/close, split/repack, partial receipt, pending requests and discrepancy review. Validate these through the demo adapter first, then a server adapter. Keep unsupported live V2 operations disabled/clearly unavailable until their actual implementation exists.

Exit requires the split-sale example, missing dispatch, copied-public-QR custody theft, two receivers racing, concurrent split/receipt, retry after timeout, recalled contents and incomplete imports to behave correctly. Review label reprint/void permissions and the risk of duplicated active physical labels.

## 7. M4 — Evidence and metrics policy

### Signal inventory and planned treatment

“Present” below means found in current source, not validated nationwide or connected to every client.

| Evidence domain | Current implementation | Planned change and interpretation |
| --- | --- | --- |
| Identifier / issuer | SS-UUID checks, configured contract and on-chain registry lookup | Add authenticated native-unit resolution and production-release status. A known code is identity evidence, not a physical authenticity guarantee. |
| Lifecycle / history consistency | Backend `conflicting_product_state`; contract roles/stages; consumer stage defects | Fix mappings and assess authorized event order/version. Mark unresolved contradictions explicitly. |
| Carton membership | No actual aggregation; enterprise `carton`/`bottle` is a kind field | Add versioned membership and split/repack validation. Production-list evidence alone does not pass this check. |
| Custody / receiver | V2 dispatch and receipt; retailer derived from confirmed custodian | Add controlled authorizations and actual unit custody. An intended recipient must not appear as the confirmed retailer. |
| Observed seller | Web case-insensitive typed retailer-name comparison | Prefer verified business/facility ID or verifiable receipt. Typed names remain a weak, user-reported observation. Unknown branch stays unknown. |
| Purchase location | Event location capture exists; no purchaser-to-retailer scoring | Ask whether scan is at shop, delivered, or later elsewhere; compare only relevant comparable locations with accuracy/source/time. A head-office address cannot serve as an exact branch position. |
| Geographically conflicting scans | Backend checks >100 km against up to 50 locations from the prior hour | Use unit scope, elapsed time, scan purpose, capture quality and legitimate travel/delivery context. Keep current threshold provisional; a consumer scan alone must not penalize a retailer's reputation. |
| Scan frequency | Backend flags >=10 scans in 10 minutes, including current scan | Deduplicate and distinguish unit/carton and logistics/consumer checks. Calibrate by normal use; frequency alone raises an investigation signal. |
| Sale / return / activation | V2 sale; enterprise individual sales; no general V2 returns | Model authorized returns and contradictory lifecycle reuse. A sold genuine item can legitimately be rescanned many times. |
| Recall / expiry / regulatory status | Recall available; expiry and regulator feeds require source validation | Separate safety findings; scope them to product/lot/unit appropriately and show freshness. A genuine recalled item must still receive a prominent warning. |
| Reports / inspections | Consumer reports local-only; backend admin scan alerts | Build shared cases with acknowledgement, evidence, review and disposition. Raw complaint volume is not proof; confirmed findings can inform relevant checks. |
| Concealed secret / secure tag | Not implemented | Optional category-specific integration after pilot economics; access controls, repeat-check semantics and anti-guessing controls required. |
| Photo / label/OCR | No assessed physical-image authentication system | Use to identify product or flag mismatching label fields. Matching packaging earns little evidential weight because it is reproducible. |
| Freshness / coverage / source reliability | Partial fallbacks and unavailable warnings | Make these explicit across every result. They qualify other checks; do not count them again as independent authenticity points. |

### Result contract

One response should contain:

- `assessmentId`, `policyVersion`, `assessedAt` and verification freshness.
- `subject`: resolved identity and scope (`unit`, `container`, `lot`, or `product_type`). Do not present a lot result as unit verification.
- `findings[]`: stable reason code, state (`supported`, `concern`, `unknown`, `unavailable`, `not_applicable`), explanation, evidence scope, source/provenance and timestamps. Include location quality where relevant.
- `identity`, `traceability`, `anomaly` and `safety` summaries. Safety warnings remain independent of a favourable identity/traceability result.
- `coverage`: which expected evidence domains were assessed, unknown/unavailable domains, and scope limitations. Count evidence groups, not matching fields.
- `custodian`: last confirmed business/facility identity and recorded event location, separate from current address.
- `recommendedAction`: for example retry identification, confirm seller, review a discrepancy, report concern, or follow a recall advisory.
- `score`: absent/null while unvalidated; later include index name, version and limitations if a public index is justified.

Detailed raw evidence, consumer coordinates and security/investigation metadata belong in authorized views, not the public response.

### Decision rules before a numerical score

1. Resolve identity and scope. Missing data/provider failure is unknown, while a reliable contradictory record is a concern. A not-found lookup is not automatically a counterfeit finding.
2. Apply authoritative safety advisories independently. Positive checks cannot cancel recall/expiry warnings. Only appropriately established findings should be described as confirmed counterfeit.
3. Evaluate identity/packing/custody contradictions with explicit reasons. Strong unresolved conflicts prevent an all-clear presentation, even when other checks pass.
4. Group correlated evidence. Barcode, serial, manufacturer name and carton association obtained from one record are not four independent proofs.
5. Report coverage separately. Define expected domains by category and claim scope in the policy; retain missing domains in that accounting. Do not renormalize a one-check result to “100%” because all other checks are unavailable.
6. Treat low-trust scans/reports as observations to corroborate. Do not let spoofed GPS, refresh loops or coordinated complaints directly rewrite custody or damage a business score.
7. Run candidate numerical policies internally against labelled cases. Select weights/thresholds only after measuring errors and calibration; document the version and source assumptions. Never describe an uncalibrated index as a probability of authenticity.

Example consumer result: “Unit identity found. Packing record matched. Last confirmed retailer: B. Seller comparison not provided. Location not assessed.” This communicates strong and missing evidence without implying a laboratory test of the contents.

### Investigations and evaluation

Convert local reports into an explicit submit-and-acknowledge workflow with draft/offline status. Do not silently upload old local reports. Add case identifiers, duplicate linking, evidence permissions, review decisions, appeals/corrections and an audit trail. Keep retailer reputation separate from an individual product assessment and introduce it only with validated attribution and review.

Create a versioned evaluation set including valid copied QR/serial pairs, wrong carton pairs, missing records, genuine travel/delivery, after-purchase rescans, false reports, stale imports, denied GPS, delayed sync and recalled/expired genuine items. Compare false positives and missed known counterfeit cases, coverage, calibration and abstention by product category and evidence quality. Verified inspections/lab outcomes are stronger labels than the app's own previous verdict. Split evaluation data by relevant lot/partner/time to avoid validating on essentially repeated records.

## 8. M5 — Proof architecture, live integration and migration

### Proof decision before contract implementation

| Option | Appropriate when | Required work / limitation |
| --- | --- | --- |
| Continue V2 unchanged | Existing products while M0/M1 are delivered | Current on-chain dispatch/receipt semantics remain; cannot claim new carton or return support. |
| New receipt-based contract | Independent on-chain custody enforcement is a firm requirement | Signed sender authorization, receiver validation, content versions, replay protection, splits, finality/reorg handling, contract tests and independent security review. Carton batching still has transaction costs. |
| Signed operational events plus periodic commitments | Lower write costs and integration flexibility matter most | Backend enforces custody; independently retained/witnessed records and inclusion proofs support audit. Commitments prove inclusion/tamper evidence, not physical truth or automatic correctness of off-chain custody. |

Preferred exploration: the third option, while maintaining a replaceable proof adapter. Confirm regulator/partner requirements before choosing it. Where the same backend controls all facility keys, separate business approval, authorization and signer access; automatic signing is already available and does not itself establish independent participant consent.

Store precise location, buyer information and commercially sensitive packing data under appropriate access control. Publish minimized proof material. A hash is not automatically anonymous: avoid exposing guessable sensitive fields through unsalted public commitments. Specify how authorized auditors obtain records and inclusion proofs, and how long these remain available. Existing public-chain records cannot be retroactively erased.

### Live-service and migration sequence

1. Add new schema/API versions and adapters alongside current ones. Back up and rehearse migration/restore against representative data. Do not repurpose existing SS identifiers or old contract addresses.
2. Classify legacy evidence conservatively: a legacy record has unknown aggregation unless its actual contents can be substantiated. Do not create fictional child units or convert one pack record into many proven bottles.
3. Select one authority per record and lifecycle. V2 records remain V2 unless explicitly migrated through a reviewed procedure; new pilot records use the selected model. Never let old and new services independently accept conflicting transfers for the same stock.
4. Connect enterprise authentication, role/facility authorization, imports and operational reads before enabling writes. Demo adapters remain confined to explicit demo mode and never become fallback live inventory.
5. Process writes through durable operation records with idempotency, authorization, retries, reconciliation and visible failures. Distinguish locally captured, accepted, submitted and proof-confirmed states. A network timeout cannot be treated as proof that a write did not happen.
6. For on-chain writes, handle chain/contract identity, finality and reorgs. For periodic commitments, display pending publication and verify inclusion against the selected external commitment. Proof failure is a separate condition from a physically suspicious product.
7. Compare old and new assessment outputs in shadow mode, then enable by partner/category. Define rollback as stopping new operations and restoring a compatible serving path; irreversible chain writes and newly recorded business events must be reconciled, not undone by deleting database rows.

### Exit criteria

Unauthorized and replayed writes fail; an accepted operation survives restart without duplicate stock movement; custody, event log and selected proof reconcile; key revocation/recovery is exercised; demo data cannot appear in live results; feature rollback preserves history. Any new custody contract receives a security review before production use.

### Capacity model

Measure peak production/import rate, units per carton, packing/split frequency, handovers, scan traffic, source latency and storage/retention. Carton custody reduces chain writes but does not remove the need to ingest and query individual unit identities.

Illustrative only: 1,000,000 units/day at 24 per carton gives about 41,667 cartons/day; one activation plus two receipts is about 125,000 chain transactions/day before splits/returns. Compare measured cost and throughput against periodic commitment publication. Include printer/line integration, operator work, support and data availability costs; wallet automation eliminates manual signing steps, not these costs.

## 9. M6 — Pilot, acceptance and rollout

Pilot one product category with usable unit serialization, one manufacturer, a distributor and a small retailer cohort. Choose based on actual export access, manageable packing integration and a useful authenticity problem; do not treat every Nigerian product category as having the same identifier, margin or workflow.

| Validation area | Required evidence before expansion |
| --- | --- |
| Identification and packing | Reconciled released units, rejected labels and carton contents; loose-unit lookup and split custody verified against physical stock. |
| Workflow safety | No custody hijack, double receipt or duplicated sale in adversarial/concurrency scenarios; exceptions have a usable resolution path. |
| Detection quality | Independently labelled cases; false-positive/false-negative rates and uncertainty by cohort, with explicit sample size. No unsupported public score. |
| Usability/adoption | Measured integration effort, packing/receiving labour, scan completion, serial-entry error rate and weak-connectivity success. |
| Operations | Agreed numeric targets for peak load, lookup latency, source/recall freshness, recovery time and cost; define targets after baseline measurement and before the pilot gate. |
| Governance | Participant accreditation, source authority, evidence access/retention, dispute handling, incident response and inspector escalation agreed with the relevant stakeholders. |
| Inclusion | Evaluate assisted/SMS alternatives where appropriate and compatibility with existing programmes, rather than assuming every consumer has a modern smartphone. |

Use GS1-compatible identification/aggregation where practical. Assess interoperability with NAFDAC traceability and Mobile Authentication Service rather than presenting SmartScan as an already approved replacement. Local product and regulator requirements must be confirmed with actual partners; published historical rollout targets do not establish current nationwide coverage.

Expansion decision: proceed only when the pilot demonstrates useful detection at an acceptable false-alarm rate, reliable physical-to-digital reconciliation, affordable operating effort and a supported investigation process. A map or higher score is not sufficient evidence of readiness.

## 10. Scope control and decisions to close

Start with M0, then M1. Avoid a simultaneous rewrite of every app, persistence and contract. Keep the consumer/enterprise design language; new screens should expose actionable evidence, not technical implementation details.

Before M2 connector commitment, obtain the pilot partner/category, real unit/packing exports and printing capabilities. Before M3 live workflow commitment, agree responsibility for packing exceptions, authorization, returns and retailer transfers. Before M5, select the proof mode, trust/key boundaries and migration authority. Before any public numerical score, approve evaluation criteria and demonstrate the required quality.

Defer image-based authenticity classification, mandatory new unit stickers for every partner, national expansion and universal scoring weights until data and economics justify them. Concealed codes/secure tags are optional physical-security enhancements, not prerequisites for correcting today's app.

## References and affected implementation areas

- [Audit and evidence/source links](SMARTSCAN_AUTHENTICATION_REVIEW.md)
- [Existing enterprise plan](ENTERPRISE_MOBILE_PLAN.md), [enterprise validation record](smartscan-mobile-enterprise/VALIDATION.md), [location behavior](smartscan-mobile-enterprise/LOCATION.md)
- [Consumer verification](smartscan-mobile-consumer/src/api/verify.js), [consumer result mapping](smartscan-mobile-consumer/src/utils/product.js), [consumer scanner integration](smartscan-mobile-consumer/src/App.jsx)
- [Backend](smartscan-backend-node/app.js), [existing migrations](smartscan-backend-node/migrations), [managed signer implementation](smartscan-backend-node/crypto-vault.js)
- [Enterprise domain](smartscan-mobile-enterprise/src/domain/types.ts), [enterprise service boundary](smartscan-mobile-enterprise/src/services/index.ts)
- [Web scan-event adapter](smartscan-frontend-react/src/api/scanEvents.js), [web transaction locations](smartscan-frontend-react/src/utils/transactionLocation.js)
- [V2 contract](smartscan-smartcontract-solidty/contracts/IdenteefiV2.sol)

This planning change does not require application builds or new test runs. Implementation milestones above specify the tests and operational evidence they must deliver; prior passing suites do not validate these proposed capabilities.
