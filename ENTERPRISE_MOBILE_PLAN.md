# SmartScan Enterprise mobile implementation plan

Status: implementation order accepted on 6 November 2026. The initial enterprise frontend is now in `smartscan-mobile-enterprise`: shared shell, four demo workspaces, supplier receiving/dispatch, manufacturer registration/recall, retailer sales/receipts, and admin business/facility operations. Live services remain disconnected. See [the app README](smartscan-mobile-enterprise/README.md) and [screen blueprint](smartscan-mobile-enterprise/DESIGN.md) for current capabilities and follow-up scope.

Follow-up proposal, 7 November 2026: [SmartScan implementation improvement plan](SMARTSCAN_IMPROVEMENT_PLAN.md) covers verification corrections, manufacturer imports, unit/carton aggregation, authorized handovers and assessment metrics. The V2 behavior and original frontend scope below describe the existing baseline; the new roadmap includes consumer fixes and future custody changes that require separate implementation and validation.

## 1. Product direction

Build one authenticated mobile application with four role-specific workspaces: Admin, Manufacturer, Supplier, and Retailer. Reuse the consumer application's visual language and established mobile behavior, while designing enterprise screens around daily operational tasks.

The first delivery should be a complete, interactive interface with clearly identified development scenarios behind replaceable service adapters. Live backend and contract integration is a separate milestone. Development fixtures must never silently substitute for unavailable live data.

The consumer application is out of scope for this phase. Its design provides the reference; implementation should not require changing that app or migrating its dependencies.

Recommended platform: React + TypeScript + Vite, packaged for iOS and Android using Capacitor. Use HTTPS browser/PWA previews for development. Native camera, lifecycle, secure storage, sharing, and printing behavior need device validation. Signing and distributing iOS builds requires macOS/Xcode.

## 2. What the existing product actually supports

Reviewed sources:

- [README](README.md): product overview, chain lifecycle, account/wallet binding, and deployment context.
- [Architecture and workflow specification](SmartScan_System_Architecture_and_Workflow_Specification.docx): intended registration, warehouse, POS, label, and managed facility-wallet workflows.
- [V2 contract](smartscan-smartcontract-solidty/contracts/IdenteefiV2.sol): authoritative role checks and custody transitions.
- [Backend](smartscan-backend-node/app.js): current account, verification, registration, facility, POS, and custody endpoints.
- [Web application routes](smartscan-frontend-react/src/App.js), [registration](smartscan-frontend-react/src/components/pages/AddProduct.jsx), [batch scanner](smartscan-frontend-react/src/components/pages/ScannerPage.jsx), [POS](smartscan-frontend-react/src/components/pages/POSCheckoutPage.jsx), and [facility administration](smartscan-frontend-react/src/components/pages/SubaccountsPage.jsx).
- [Consumer design](smartscan-mobile-consumer/DESIGN.md): palette, rounded surfaces, navigation, typography, motion, and safe-area treatment.

The specification describes intended behavior and includes historical readiness/performance claims. This review does not validate those claims or the state of a deployed environment. Current local source takes precedence where descriptions differ. Sepolia is a test network.

### Two independent state models

Registration processing currently uses `pending_wallet`, `submitted`, `confirmed`, `failed`, and `needs_retry`. These describe creating the product's on-chain record.

The V2 custody stages are `None = 0`, `Manufactured = 1`, `Dispatched = 2`, `Delivered = 3`, `Sold = 4`, and `Recalled = 5`. Its history action enum is separate and starts at `Manufactured = 0`. Do not interchange action IDs and stage IDs.

The interface must distinguish registration status, custody status, verification freshness, and operation progress. A confirmed registration does not establish warehouse inventory or permission to sell.

### Supported custody flow

1. A manufacturer registers a serialized physical item and becomes its custodian.
2. That manufacturer dispatches it to a supplier.
3. The eligible supplier confirms receipt and becomes custodian.
4. A supplier can dispatch to another supplier or a retailer; the recipient confirms receipt.
5. A retailer can record a sale only after receiving the item and while its wallet is the current custodian.
6. The original manufacturer or an on-chain Admin may recall a registered item, including a sold item. Recall blocks further normal custody/sale operations.

Directed dispatch names a recipient wallet. Open dispatch allows an eligible downstream wallet to claim receipt. Per the user's device review, open dispatch is preselected for every new dispatch review. Display its eligible receiver rule and allow an optional named facility; choosing one restricts receipt to that facility.

The contract has no general product editing, shipment cancellation, return/refund, unrecall, inventory quantity adjustment, payment collection, or atomic multi-item custody method. A sale does not delete or burn the product's readable provenance record. Avoid promising these behaviors through screen copy.

## 3. Role and permission model

| Role | Daily workspace | Allowed business actions | Key boundary |
| --- | --- | --- | --- |
| Admin | Organizations, account/facility readiness, operation failures, scan alerts | Create/manage business accounts; provision/approve/revoke facility wallets; oversee funding; inspect audit history; initiate authorized recalls | An app Admin is not automatically the contract owner. Owner-only role changes need the configured owner execution path. Admin inspection does not imply custody or permission to sell. |
| Manufacturer | Own product registrations, ready-to-dispatch items, outgoing items, exceptions | Create a serialized product; resume registration; prepare QR/labels; dispatch eligible owned items; recall products it manufactured | Confirmed product identity/history cannot be edited or deleted. A manufacturer can recall its own products even after custody has moved. |
| Supplier | Incoming deliveries, warehouse custody, outgoing items | Receive eligible dispatches; dispatch held items to another supplier or retailer; review/export scan sessions | Registration alone is not stock. Receipt requires recipient eligibility; dispatch requires current custody. |
| Retailer | Incoming deliveries, available stock, sale operations | Receive eligible deliveries; inspect product provenance; record sale; view/share/reprint confirmed sale records | The exact acting wallet must hold delivered custody. Verification does not itself record a sale or process payment. |

An account's role comes from the authenticated service. A production role picker must not grant permissions. A development-only scenario selector may preview the four workspaces.

Treat signed-in account, business profile, acting facility, facility wallet, and product custodian as separate concepts. Show the active facility in the workspace header and action review. Never silently change a facility after scanning or after an operation has started.

The current model links facility subaccounts to a parent username; it is not a complete employee/team membership system. Start with existing business accounts. Individual employee permissions, shifts, supervisor approval policies, and cross-organization membership require an explicit backend extension.

## 4. Navigation and screen inventory

Use four quiet bottom tabs, preserving the consumer application's visual rhythm:

| Workspace | Tabs |
| --- | --- |
| Manufacturer | Home / Products / Scan / More |
| Supplier | Home / Inventory / Scan / More |
| Retailer | Home / Inventory / Scan / More |
| Admin | Overview / Accounts / Operations / More |

Receiving, dispatching, and selling are prominent workspace actions and scanner modes. Admin gets product lookup/scan through an Overview or Operations action. Activity is accessible from Home and More, with pending work surfaced directly on Home.

### Shared screens

- Sign in, expired session, account unavailable, facility selection/readiness.
- Home: business/facility identity, a short needs-attention queue, role-specific primary action, meaningful counts, recent activity. Counts open the filtered records they represent.
- Product list: search by serial/name/brand; custody and processing filters; paginated mobile rows; loading, empty, failed, refreshing, and stale states.
- Product detail: identity/photo, separate registration/custody labels, current custodian, recipient when in transit, last checked time, allowed next action, history timeline, QR, secondary map, and transaction details on demand.
- Scanner: choose task, scan QR/compatible barcode or enter serial; torch only when available; camera error/retry; single-item and continuous-session modes.
- Action review: item count, exact task, acting facility, destination or location, exceptions, and the consequence of confirming.
- Operation progress/detail: waiting, submitted, checking confirmation, complete, failed, or needs review; per-item outcomes for a session.
- Activity: product/operation links, actor/facility, time, status, and recoverable work.
- More: profile, facility context, account/password controls, scan feedback preferences, help, sign out.

### Role additions

- Manufacturer: registration form/review, registration progress, recoverable drafts, label preview/export, dispatch selection, recall with reason and confirmation.
- Supplier: receiving session, outgoing session with recipient selection, incoming/outgoing filtered inventory, session manifest export.
- Retailer: receiving session, sale verification/review, confirmed sale record, receipt/share/reprint, sale activity. Begin with per-item sale recording; multi-item checkout comes after operation handling supports partial outcomes.
- Admin: organization list/detail, create account, account/wallet state, facility list/detail/provision/approve/revoke, funding status, scan-alert detail, failed-registration/operation detail, audit history, recall review. Advanced legacy repair tools can remain in the existing web admin initially.

Operational lists should be searchable and scannable. The consumer passport carousel is useful for exploring a few records, but should not be the main enterprise inventory interface. Preserve search/filter/scroll position when returning from an item.

## 5. Core interaction flows

### Manufacturer registration and dispatch

Enter product name, brand, description, photo, and recorded facility/location; generate one canonical serial for one physical item; review; submit; show registration progress; then enable label/QR output and dispatch when confirmed.

Save unfinished form input separately from a submitted product. Keep the same serial through registration recovery. Product fields must fit the API's effective limits, including any narrower limits than the contract.

Offer registration followed by dispatch as a convenient guided sequence, while showing each operation separately. If registration succeeds and dispatch fails, preserve the successful registration and resume dispatch without registering again. A quantity field must not accidentally put the same serial on multiple physical units.

### Supplier receiving and dispatch

Choose Receive or Dispatch and the acting facility; collect scans; suppress camera repeats and duplicate session entries; resolve eligibility; review accepted items and exceptions; submit; show individual outcomes; save/export the session.

For Dispatch, default the destination to open dispatch, with an optional eligible named recipient before execution. For Receive, display the sender and whether the item is specifically addressed to this facility or available through open dispatch. Unknown, recalled, sold, wrong-recipient, and unverifiable items remain exceptions.

Batch capture and transaction completion are separate. A scan can enter the queue immediately, but only verified eligible items can execute. Existing contract writes occur per item; a session can partially complete. Retry only unresolved items after rechecking their state.

### Retail sale

Scan; check current authoritative state and acting-facility custody; review; record sale; show confirmed result; create or retrieve a persistent sale record; share/print its receipt.

Keep verification feedback separate from sale confirmation. A pre-sale verification slip must not be presented as a completed sale receipt. Receipt printing can be retried without recording another sale. Show the recorded transaction/facility and preserve recovery when the app is backgrounded.

The first release records provenance sale status; pricing, payments, stock purchasing, refunds, and accounting integrations are separate scope.

### Admin account/facility operations

Create or select a business account; view its assigned role and facilities; provision a facility; show approval/funding readiness; authorize the applicable administrative action; track its result; retain an audit entry.

For routine staff work, use the existing managed facility-wallet direction so employees do not handle seed phrases or install MetaMask. Wallet/gas detail belongs in readiness/help/admin views. External signing, when required for an owner action or wallet binding, needs a deliberate mobile connector/deep-link flow; Safari and Capacitor cannot be assumed to provide `window.ethereum`.

## 6. Visual and mobile behavior

Use the consumer palette: navy `#000336`, raised indigo `#303a80`, detail blue `#4656a6`, pale accents `#dfe5ff` and `#f0f3ff`. Retain Plus Jakarta Sans, Lucide icons, white/off-white rounded surfaces, restrained shadows, raised pill actions, and bottom sheets for short focused interactions.

Keep longer registrations and operational sessions on full screens. A large decorative scanner panel should not hide the session queue, task, or feedback during repetitive work. Use a compact summary and clear thumb-accessible controls.

Use brief state transitions and optional haptics/sound to distinguish scan captured, exception, and operation confirmed. Honor reduced motion and device feedback preferences. Do not use a success chime for an unverified item or a transaction still pending.

Carry over the lessons from the consumer app: safe-area insets, a single viewport-height owner, no overlapping hint/frame, no phantom bottom gap, accessible modal focus, camera cleanup, and correctly bounded horizontal lists. Test with the keyboard open, larger text, smaller phones, and landscape. Native screenshots must supplement browser emulation.

## 7. Frontend structure and service boundaries

Proposed app organization:

```text
smartscan-mobile-enterprise/
  src/
    app/              # routes, session, workspace shell, providers
    design/           # tokens, buttons, fields, cards, sheets, feedback
    domain/           # role/custody rules, identifiers, operation types
    features/
      auth/
      overview/
      products/
      scanning/
      custody/
      sales/
      administration/
      activity/
    services/         # typed API interfaces and live adapters
    platform/         # scanner, lifecycle, secure storage, share/print
    dev/              # explicit fixture scenarios and mock adapters
```

Use React Router for navigation and a query cache for asynchronous records, pagination, invalidation, and retry behavior. Keep domain authorization separate from rendered button labels. Use one typed capability calculation whose inputs include role, acting wallet, active facility state, chain configuration, product stage, current custodian, intended recipient, and fresh verification state. The API/contract remains authoritative.

Mock and live implementations should implement the same interfaces. Initial fixtures should cover an empty facility, normal manufacturer registration, a supplier handover, retail sale, wrong recipient, recall, revoked facility, offline state, partial batch, and uncertain transaction outcome.

Introduce platform adapters rather than scattering browser/native checks through screens. Native authentication secrets belong in platform secure storage; do not copy business tokens into general localStorage. In browser previews, follow the supported session strategy and expire access clearly. Namespace local drafts/sessions by account and facility, isolate or clear them on logout, and retain no wallet private keys on the client.

Keep consumer design reuse local to this new app initially. Extract a shared design package only when both apps need ongoing shared development, avoiding a consumer refactor as a prerequisite.

## 8. Integration gaps discovered in the review

These are future integration requirements, not backend edits authorized by this planning step.

| Finding in local source | Consequence for enterprise implementation |
| --- | --- |
| `/product/chain-status` returns registration records; supplier/retailer access is broad, and some dashboard counts treat these as inventory. | Add server-scoped, paginated custody/incoming/outgoing read models. Counts and filtered lists must use the same facility/custody definitions. Do not fetch the whole registry to label it My inventory. |
| `/api/subaccounts` is Admin-only, although handler code contains a non-admin branch. Execution can select the most recently updated facility when no ID is provided. | Add authorized business-facility discovery and always submit explicit facility context. Define who can select each facility. |
| The web custody helper exposes some actions from role/stage without enforcing the recorded recipient/current-custodian conditions and has a permissive default. | Implement and test the mobile capability matrix against contract rules; unknown/unavailable state must be non-executable. |
| `/api/pos/checkout` verifies and returns receipt metadata; it does not perform `markSold`. Some web receipt UI can open before sale confirmation. | Separate verification from recorded sale and persist a sale/receipt identity tied to confirmed execution. This endpoint alone is not a completed checkout. |
| Facility auto-execution waits within the request and does not expose a general durable operation ID/status API. | Introduce persisted operation IDs, idempotent submission, transaction-hash recording before waiting, status lookup, reconciliation, and safe retry across app restarts. Serialize writes per signer to avoid nonce collisions. |
| Auto-execution can attempt role grants/reactivation before enforcing a facility's revoked state. | Enforce approval/revocation independently of operational execution; an ordinary scan/action must not silently restore administrative permissions. |
| README describes strict reconciler confirmation, while auto-execution and a separate existence probe can also set registration to confirmed. | Align all write paths with the chosen chain/contract/signer/event/confirmation policy before live release. UI must not paper over inconsistent confirmation semantics. |
| The headless action endpoint supports registration, dispatch, receipt, and sale; recall is a contract action with an existing direct-wallet UI path. | Specify an authorized mobile recall execution path instead of assuming the headless endpoint already supports it. |
| Scan alerts exist, but there is no reviewed alert case-assignment/resolution API. Consumer reports currently remain on the consumer device. | First admin screens can inspect available scan alerts. Shared consumer-report inbox, case handling, push delivery, and resolution tracking need separate backend work. |
| Contract and historical client status representations differ. | Use the V2 enums through typed adapters; record consumer compatibility checks for its later integration milestone without changing it now. |

Additional API needs should be specified before integration: session/account capability refresh, eligible recipient lookup, account/facility scoped search, persistent operation/activity records, receipt retrieval/reprint, and scan-session storage. Public QR destinations should use a configured verification origin so enterprise-generated labels continue to work for ordinary phone cameras.

## 9. Reliability rules

- A fresh scan, an eligible action, a submitted operation, and a confirmed operation are different events.
- Submission returns a stable operation identity. If a request times out after broadcast, show Checking status and reconcile before retrying; never submit a replacement action blindly or silently switch signing methods.
- Recheck eligibility immediately before execution. Two devices may scan the same item, or a recall/revocation may occur after review.
- Preserve server-confirmed work when a batch is interrupted. Completed items cannot be undone by deleting the local session.
- Backgrounding stops the camera and pauses capture. Resume refreshes session, facility, product, and operation status before enabling another write.
- Offline mode can retain local form drafts, captured codes awaiting verification, and clearly timestamped cached records. It cannot confirm custody, register authenticity, or record a sale. Reconnection triggers validation and deliberate resumption.
- A batch processes per-item results and bounded work per wallet. Network latency is not a measured throughput guarantee; scan responsiveness must not be confused with blockchain confirmation speed.
- Location records distinguish configured facility address, user entry, and device estimate. Denied GPS has a clear fallback; approximate coordinates do not prove physical possession.
- Verification language must reflect what is known: unregistered, already sold, recalled, or unavailable. These states alone do not prove that a physical item is counterfeit.

## 10. Delivery sequence and acceptance gates

| Milestone | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Workflow/design blueprint | Confirm this role matrix, screen map, state definitions, navigation, and fixture scenarios; sketch the main screens in the consumer style | Every task has an entry point, actor, preconditions, success state, failure state, and recovery route. |
| 2. Enterprise foundation | Scaffold the separate TypeScript app, design primitives, routes, session/facility shell, typed adapters, and explicit development scenario selection | Four coherent workspaces render correctly on phone sizes; unauthorized demo roles do not share capabilities; no consumer changes required. |
| 3. Representative end-to-end flow | Implement supplier Receive -> inventory -> Dispatch, scanner sessions, product detail, review, and recoverable operation screens using fixtures | Normal, wrong-recipient, duplicate, offline, partial completion, and interruption cases work; phone interaction is reviewed before multiplying screens. |
| 4. Complete four-role interface | Add manufacturer registration/labels/recall, retailer sale/receipt, and admin account/facility/operations screens | Every in-scope flow is interactive with explicit pending/error/empty states and realistic scenarios, not decorative dead ends. |
| 5. Backend/contract integration | Resolve the integration gaps; replace adapters progressively; implement durable operation and receipt handling; verify configured test deployment compatibility | Each live action enforces account/facility/contract rules, survives interruption, and reconciles to an authoritative outcome. |
| 6. Native/device validation | iOS/Android builds, physical QR/barcode samples, camera lifecycle, secure sessions, haptics, sharing, receipt/label export, target printer tests | Full four-role journey passes on real devices with no duplicate writes or misreported success. Release review follows separately. |

The first code milestone should establish the shared shell and one complete operational flow. This lets us evaluate the design and transaction behavior before building many role-specific screens on top of it.

## 11. Validation matrix

| Area | Meaningful checks |
| --- | --- |
| Permissions | All role/stage combinations; exact recipient/custodian; other manufacturer's recall; unlinked/pending/revoked facility; changed role/session; Admin versus owner capability. |
| Registration | Preserve serial/draft; duplicate identifier; upload failure; registered-but-not-dispatched; delayed confirmation; interrupted retry; field-limit agreement. |
| Receiving/dispatch | Manufacturer -> supplier, supplier -> supplier, supplier -> retailer; directed/open recipient rules; sender cannot receive its own dispatch; stale custody. |
| Retail | Wrong facility; not delivered; already sold; recalled before sale; repeated taps; sale confirmation before receipt; failed printing followed by reprint without another sale. |
| Operations | Server accepts then phone disconnects; app killed/reopened; auth expires while pending; partial batch; RPC unavailable; gas unavailable; operation confirmed while UI was offline. |
| Scanner | Same code in consecutive frames; deliberate rescan in a new task; invalid/foreign QR; photo/manual input; supported barcode scanner input; permissions, torch, camera switching, background cleanup. |
| Mobile/accessibility | Small/large phones, iPhone safe areas, Android back, keyboard, landscape, larger text, focus/screen reader labels, reduced motion, optional audio/haptics. |
| Data consistency | Counts match listed records; products scoped to facility; timestamps/freshness visible; no synthetic production data; latest contract state wins over cached eligibility. |

Use focused unit tests for capability/state rules, adapter/integration tests for operation handling, browser interaction tests for workflows, and native hardware checks for device functions. Existing repository tests are useful references but are not evidence that the new mobile flows have passed.

## 12. Explicit later scope

Defer a production chain migration, contract redesign for pallet/Merkle batching, NFC tags, payments/refunds, accounting/ERP integrations, direct vendor-specific Bluetooth printing, sophisticated employee permissions, automated approvals, push notifications, consumer-report synchronization, and advanced admin repair tools until their requirements and supporting services are agreed.

Initial printing should provide clear label/receipt previews and file/share/system-print paths; direct printer support depends on actual printer models and platform support. Multi-scan workflows remain in scope, but a group of individual serials must not be represented as a contract-level batch that does not exist.

Defaults accepted for the first build: all four workspaces; managed facility wallets for routine actions; explicit facility context; open dispatch by default; per-item retail sale; continuous warehouse capture with review; frontend scenarios first; live integration in a separate milestone.

Device-review refinement: a product passport's "Sell this item" opens a review containing only that serial, independently of any saved sale queue. Scanner sales have explicit per-item checkboxes and select-all/deselect-all controls; only selected serials are submitted. Unselected items remain in custody and in the saved session. Retailers can also add held items from an inventory picker without using the camera.

### Packaging and serialization proposal (future scope)

Serialize the smallest sealed unit that can be sold separately: usually one bottle or its individual sealed box. If a multipack is only ever sold sealed, its pack can be the unit; once bottles are sold separately, each needs its own identity. Reusing one serial on several bottles conflates their custody, sale, recall, and consumer scan records.

Use one product/label template with automatically generated unique serials for a production run, exported for variable-data label printing or an inline printer. Record print/commissioning outcomes and reject/reprint handling so labels are not accidentally reused. A small pilot can use sheets or rolls of unique labels before production-line integration.

Give each shipping carton a separate identifier linked to its contained unit serials (and optionally cartons to pallets). A logistics scan can expand that container into a review of its units; confirmed outcomes must remain per item. Packing, unpacking, partial sales, and repacking must keep that membership accurate. This aggregation and production-run workflow is a proposal, not implemented support. The current contract records individual serials and has no container membership or atomic batch movement; one carton scan would not make one blockchain transaction. Measure costs/throughput before choosing a later batching design.

A public QR can be copied even when its serial is unique. Pair serial verification with appropriate tamper-evident packaging and scan-anomaly checks; consider concealed one-time verification codes for products needing stronger protection. Repeated legitimate scans must not automatically be treated as counterfeit. These protections need live supporting services and do not follow merely from storing a serial on-chain.

### Confirmed retailer and transaction location (7 November 2026)

Retailer identity already comes from `currentCustodian` after `confirmDelivery`; a pending dispatch recipient does not establish custody. Keep this contract rule. A separate branch entity is not a prerequisite: show the recorded retailer and distinguish its registered profile address from a device-reported transaction location. A company-level address must not be described as a verified branch address.

Web registration, dispatch, receiving, checkout, batch actions, and recall now capture location at submission. Permission-denied/unavailable capture uses a labelled profile address, or explicitly records location unavailable. Existing editable location forms preserve manual entries and label them accordingly. A batch uses one measurement for its items. Device coordinates and reported accuracy are retained with the source in the existing on-chain location string, within the 200-byte contract limit; long address text may be shortened. This needs no contract migration. Registration retries retain the originally saved registration location.

The enterprise demo uses a shared submission boundary to capture device location and stores its address, source, coordinates, accuracy, and capture time on the operation and confirmed history. Operation details, receipts, manifests, and journeys display this snapshot. Old records are not retrospectively geolocated. The demo remains local; these records have not been written to the live contract.

Browser capture requires a secure origin and location permission (separate from camera permission). Address lookup currently uses BigDataCloud and may return only an area. GPS/Wi-Fi readings are estimates and client-reported evidence, not proof of physical presence. Denied permission does not silently become an IP-based shop address. A retailer mismatch is grounds for investigation, not by itself proof of counterfeiting; a match also cannot rule out a copied code sold at the same retailer.

Next integration milestone: choose one manufacturer that already serializes individual units. Obtain representative unit-serial, packing/aggregation, and shipment exports; map its existing unique carton identifiers and unit membership before deciding whether any additional SmartScan labels are necessary. Shared SKU/EAN codes alone cannot provide individual identity. Agree split/repack/reject handling and idempotent imports before selecting an API, file import, or production-system connector. Blockchain batching remains a separate measured design decision; automatic integrated-wallet signing is already present and does not remove transaction throughput/cost constraints.
