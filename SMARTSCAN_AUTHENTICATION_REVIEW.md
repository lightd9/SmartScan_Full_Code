# SmartScan authentication architecture review

Reviewed 7 November 2026. This is a code audit and design proposal, not an implemented scoring model or a change to the current contract. The enterprise application remains a local demo.

Follow-up: [implementation improvement plan](SMARTSCAN_IMPROVEMENT_PLAN.md) translates these findings into milestones, acceptance criteria, an evidence policy and migration gates. Its proposed changes are not yet implemented.

## Recommendation

Keep SmartScan's multi-signal verification objective. Build the core around authenticated manufacturer records, individually identifiable saleable units, explicit carton membership, authorized custody events, and explainable evidence. Treat blockchain as an optional independent audit layer. It does not establish the physical truth of production, packing, receipt, location, or product contents.

For a pilot, use a shared database with signed business events and an append-only audit history, and make the selected proof layer replaceable. If retaining blockchain is a project requirement, a receipt-based design with off-chain sender authorization is reasonable, but requires a different contract. Do not allow any registered receiver to manufacture missing dispatch authorization.

## 1. Four identifiers with different purposes

| Identifier | Identifies | Limitation |
| --- | --- | --- |
| Product type / SKU / GTIN, often on EAN/UPC | A product type and packaging configuration | Usually shared by many physical items. |
| Production batch / lot | Units made in a production run | Can span many cartons and retailers. |
| Unit identity | One saleable bottle, box, or other sealed unit | A printed serial is still copyable. Namespace it by issuer and product where required. |
| Carton / logistics-container identity | One physical shipping container | Does not identify individual contents unless membership is recorded. |

A practical lookup key is `(manufacturer identity, product identifier, manufacturer serial)`, mapped to a stable internal SmartScan unit ID. Do not assume serials are globally unique, preserve leading zeros, and follow each issuer's documented case/format rules.

## 2. Linking units to SmartScan cartons

Yes, SmartScan can issue a unique carton QR and link manufacturer unit serials to it. The missing data is an authoritative packing event, not another QR-printing trick.

Example:

```text
Manufacturer M1, product P1, production lot L7
SmartScan carton C101: units U001, U002, U003
SmartScan carton C102: units U004, U005, U006
```

Receiving only `lot L7 produced 6 units` cannot establish which units went into each carton. Even a complete production serial list is insufficient without the packing assignments. Do not infer contents from consecutive serial numbers unless the production system explicitly guarantees the association and handles rejects/rework.

Ways to obtain the association:

| Method | Advantages | Disadvantages |
| --- | --- | --- |
| Import the manufacturer's existing aggregation events | Lowest additional work where available; accommodates high-speed lines | Vendor-specific connector and mapping needed. |
| Scan/read unit codes at packing, then close the carton under a SmartScan ID | Explicit observed membership; works without an existing aggregation export | Scanning equipment, line integration, exception handling and throughput costs. |
| Manual/handheld pack-building station | Practical for a small pilot or low-volume maker | Labour-intensive and error-prone at high volume. |
| Production list plus carton quantity only | Easy to integrate | Supports quantity/batch tracking, not exact unit-to-carton provenance. |

Use distinct label states: `reserved -> printed -> packed/activated -> dispatched -> received -> opened/split -> closed/void`, with a deliberate policy for reprints, destroyed labels and corrections. Preallocating IDs is acceptable; an unused allocated label must never appear as a manufactured, authenticated product. Bulk allocations do not require one blockchain transaction per blank sticker.

Prefer authenticated, replay-safe imports scoped to the manufacturer, with event IDs, production disposition, packing assignments, corrections and timestamps. "Code printed" is not necessarily "unit passed inspection and was released for sale". Production and packing reports are attestations and can still be wrong or fraudulent.

SmartScan may control the identifier scheme and label format without physically printing every sticker centrally. A manufacturer can print allocated IDs using its line. Mandatory additional stickers create application, reconciliation and waste costs; where an existing unique carton code works, aliasing it to a SmartScan container can reduce adoption friction.

GS1 EPCIS already describes aggregation using a parent identifier and child identifiers. Use standards-compatible events where practical rather than making carton membership a proprietary concept.

## 3. How a consumer identifies one bottle

| Option | Works for an individual unit? | Tradeoff |
| --- | --- | --- |
| Scan the manufacturer's existing code containing product ID and unique serial | Yes, if SmartScan can parse it and the issuer's data is integrated | Best default when available; support GS1 DataMatrix and other formats as well as QR. |
| Scan the ordinary product barcode, then scan/OCR/type the printed unique serial | Yes, as a combined lookup | No new unit label, but more steps and transcription/OCR errors. |
| Print a unique SmartScan QR on each unit | Yes | Smooth lookup, but adds printing/application work unless integrated into the existing line. |
| Repeat the same carton QR on every unit, then require the unit serial | Only the combined carton context and unit identity can distinguish units | Transitional option; copying the QR alone does not create or prove membership. The service must validate the pair. |
| Repeat the carton QR alone on every unit | No | All bottles share one identity, sale state and scan history. Legitimate scans can trigger false clone alerts. |
| Photo recognition plus ordinary barcode and production lot | Product/lot lookup only | Cannot distinguish genuine units from counterfeits carrying copied packaging and lot information. |

A consumer should not need the outer carton to verify a loose bottle. If the manufacturer already provides usable unit identity, the unit can resolve its own packing and custody history through SmartScan's database. A QR is a carrier for an identifier, not the identity itself and not an anti-copy feature.

If a carton is opened and distributed across retailers, record which units or explicitly identified subcontainers go to each retailer. A former parent cannot give every separated child the same new retailer. Keep historical packing membership and time/version information; do not overwrite it with the latest parent. An original carton code on a unit must not cause its later custody to follow an obsolete carton assignment.

A copied valid unit serial plus its matching carton code can pass membership checks. Concealed one-time secrets, tamper-evident packaging, controlled sale activation, or cryptographic tags can add evidence; their costs and failure modes differ. A normal barcode, QR, digital signature, or database match alone cannot prove the contents of a physical bottle.

## 4. Receipt-only blockchain transactions

The current contract requires an on-chain dispatch before on-chain receipt. It has no container membership model, signed off-chain dispatch authorization, or grouping of many unit transitions into one container transaction. The proposed flow is a contract/data-model redesign, not a UI setting.

Recommended variant if blockchain is retained:

1. Import authenticated production and packing records; activate a carton with its contents/version.
2. The current custodian approves dispatch in the app or through its ERP. Its managed wallet signs a handover authorization off-chain; this need not submit a transaction or charge gas.
3. The receiver accepts the actual delivery. One blockchain transaction verifies both sender authorization and receiver eligibility, and records the custody transfer.
4. Authorizations bind the container/content version, sender, intended receiver or controlled claim policy, expected custody version, nonce, expiry, chain and contract. They must not be reusable or executable on another chain.
5. When dispatch was omitted, allow a pending receipt request. Obtain sender approval or reconcile against an authenticated shipment instruction before changing confirmed custody. Preserve the exception and actual timestamps; never invent a historical dispatch.

Allowing any registered party to take custody after scanning a public carton QR creates a custody-hijacking route. Registration identifies a business; it does not authorize that business to receive every carton. Even an open dispatch should not make the public label a sufficient claim credential. Bind the actual receiver at handover or use a separate controlled delivery authorization.

"Dispatch destination" and "dispatch origin location" are different. A destination selector may remain optional until handover. Origin evidence can still be useful without restricting where the carton goes; removing a blockchain dispatch transaction does not require deleting its off-chain event or location.

Managed wallets already automate submissions. The backend currently decrypts and operates facility keys in `smartscan-backend-node/crypto-vault.js`. This supports convenience, but blockchain signatures alone do not establish independent business approval if one service controls all those keys. A production design needs a clear signer/control boundary, business approvals, protected keys and revocation/recovery procedures.

## 5. Existing signals found in code

| Signal / capability | Evidence in repository | Present limitations |
| --- | --- | --- |
| Registry identifier and configured-contract checks | `smartscan-backend-node/app.js:60`, `:1468`; web scanner and contract | A known identifier can be copied; backend currently expects SS-UUID rather than imported native unit identifiers. |
| Authorized issuer and custody-transition permissions | `smartscan-smartcontract-solidty/contracts/IdenteefiV2.sol:137`, `:167`, `:196` | Registration/role authorization does not independently establish physical product authenticity. |
| History consistency flag | `smartscan-backend-node/app.js:64` | Checks event sequence, stage, role and recipient consistency; not physical possession. |
| Recall and sale-state checks | Contract, backend POS and web UI | Consumer mobile mappings are inconsistent with V2; sale is not inherently evidence of a counterfeit after purchase. |
| Recent geographically distant scans | `smartscan-backend-node/app.js:1508` | Looks at up to 50 previous locations within one hour and flags over 100 km. Compares scans with scans, not purchase point with retailer. Coordinates are browser-reported and rounded to two decimals. |
| Scan-frequency flag | `smartscan-backend-node/app.js:1525` | Flags at least 10 scans in 10 minutes, including the inserted scan. Not a calibrated threshold; duplicate scans and shared carton codes create false alerts. |
| Retailer comparison | `smartscan-frontend-react/src/components/pages/Product.jsx:594` | Manual case-insensitive name comparison against current-custodian retailer. No verified observed-store identity or combined score. |
| Transaction-location capture | Web `utils/transactionLocation.js`; enterprise `platform/location.ts` | Device estimates and labelled profile/manual fallbacks. Neither proves exact branch or product presence. Enterprise persistence is demo-only. |
| Journey map | `smartscan-mobile-consumer/src/components/SupplyMap.jsx` | Connects recorded/resolved stops, sometimes using approximate address geocoding. Lines are not observed travel routes. New source-labelled location strings need an explicit parser before distance scoring. |
| Consumer reports | `smartscan-mobile-consumer/src/components/ReportTab.jsx` | Saved/downloaded on-device; not submitted into an investigation or reputation service. |
| Anomaly service unavailable warning | `smartscan-frontend-react/src/api/scanEvents.js` | Web plumbing exists; consumer mobile currently does not submit `/scan-events` or consume these flags. |
| Combined authenticity scoring | No implementation found in the reviewed backend, web or mobile source | No shared rule engine, calibrated weights, evidence-coverage calculation or manufacturer production/packing connector. |

Priority correctness issues before adding a score:

- Consumer `src/api/verify.js:88` treats stage 4 as recall and stage 3 as sold. Consumer `src/utils/product.js:5` also treats stage 4 as recall. V2 defines Delivered=3, Sold=4, Recalled=5.
- Consumer results can describe a registered code as an authentic physical product. Registry absence is also not sufficient to call an item counterfeit: the maker might be outside coverage, the import may be pending, or identification may have failed.
- Current native-code lookup, aggregation, unit splitting and shared scoring are not implemented. Enterprise's `kind: carton | bottle` is a display/data attribute, not a parent-child relation.

This audit did not change application behavior or deploy anything. Earlier passing test suites do not establish correctness for the missing features or the consumer defects above.

## 6. Designing useful authentication evidence

| Candidate evidence | Value | Controls / limits |
| --- | --- | --- |
| Exact unit on authenticated production/release list | Establishes that the issuer reported this identity as produced and released | Reject unassigned, voided or rejected codes; copying a valid serial remains possible. |
| Unit/carton membership and packing history | Connects unit provenance to logistics events | Version membership, splits, repacks and corrections; packing data itself must be trustworthy. |
| Sender-authorized custody and receiver acceptance | Detects missing/unauthorized chain links | One party cannot create the other party's approval; collusion remains possible. |
| Seller identity matched to recorded unit custodian | Supports channel verification | Prefer business/store identifiers or a receipt to typed-name matching; model legitimate transfers and returns. |
| Purchase-point distance from recorded receipt/sale site | Can support a diversion/cloning warning | Ask whether scan is at purchase; account for delivery, travel, accuracy, timestamp and head-office fallback. |
| Same unit in incompatible places/time windows | Can detect copying more strongly than a simple radius | Deduplicate, distinguish logistics/consumer scans, account for spoofing and event sync delays. |
| Sale/activation/return lifecycle | Reveals contradictory reuse | After-purchase scans are normal; scanning must not silently mark a product sold. |
| Concealed one-time verification code | Adds evidence of access to a protected physical feature | Protect unused codes, rate-limit guessing and explain repeat checks; not absolute proof of contents. |
| Cryptographic NFC or other challenge-response tag | Stronger resistance to simple digital copying | Tag/application cost, key provisioning, readers and tag transplantation. |
| Recall, expiry, licence and regulatory product status | Critical safety/authorization context | Authoritative updates and timestamps; genuine products can still be expired or recalled. |
| Verified complaints, inspections or laboratory findings | Strong escalation evidence | Authenticate findings, link their scope correctly, allow investigation/appeal; avoid report brigading. |
| Packaging/label inconsistencies and photo/OCR checks | Helps select product and surface obvious mismatches | Appearance is copyable; matching artwork should not provide strong authenticity credit. |
| Source freshness, device accuracy and partner reliability | Determines how much to rely on other evidence | Missing GPS/network data is unknown, not adverse evidence; avoid double-counting correlated records. |

Do not simply add points for each matching field. Manufacturer, barcode, serial and carton results may all come from one copied record. A recalled/expired product must not be labelled safe because unrelated checks score highly. Identity-invalid, safety-alert, supply-chain-conflict and insufficient-evidence outcomes should remain explicit.

Start with rule explanations and evidence coverage, for example `unit found; carton membership verified; retailer matched; location not assessed`. If a numerical score is later added, version its policy and show coverage separately. Do not call `85/100` an 85% probability of authenticity without validating calibration against independently established genuine and counterfeit cases. Measure false alarms and missed counterfeits by product category, seller type, region and capture method.

## 7. Technology comparison

| Model | Advantages | Disadvantages / gaps |
| --- | --- | --- |
| Manufacturer API lookup only | Lowest logistics adoption burden; reuses issuer records | Usually cannot identify final retailer; APIs differ, fail or disappear; no unit proof when only lot data exists; manufacturer controls its assertions. |
| Shared SmartScan event database with signed events and append-only audit | Supports aggregation, custody, investigations and evidence rules at low operating cost; flexible corrections | Operator/governance trust remains; signatures need protected business keys and externally verifiable copies/witnesses to expose suppression or rewritten history. |
| Public-chain carton registration and receipt events | Independently inspectable ordering/finality of published records; fewer transactions than per-unit custody | Fees, throughput, metadata exposure, key management, contract changes and split handling; cannot prove physical contents or location. |
| Signed operational database plus periodic public-chain commitments | Most operational flexibility with independently timestamped commitments; amortizes chain cost | Audits are delayed; must retain event data and inclusion proofs. A commitment does not itself prove an event was true or guarantee off-chain custody rules. |

Hashes/roots can commit to sets of unit identities, carton membership, or events. Each proves a different claim. A production-list commitment does not prove which carton held a unit; a packing commitment does not prove later custody. Sensitive precise coordinates, buyer data and commercial details should generally remain access-controlled, with suitable proofs rather than public plaintext.

Hypothetical sizing, not a Nigerian market estimate: 1,000,000 bottles/day at 24 bottles/carton is approximately 41,667 cartons/day. One carton activation plus two receipts is about 125,000 chain transactions/day, before splits, additional distributors, returns or other writes. This is a substantial reduction from per-unit writes, not zero cost. Pre-issued blank labels need not add individual transactions. Test the selected network and state model under peak loads rather than assuming automatic signing solves scale.

## 8. Nigeria adoption and next decision

NAFDAC already publishes a National Pharmaceutical Traceability Strategy and operates Mobile Authentication Service (MAS), using concealed one-time PINs and SMS. A SmartScan proposal should demonstrate interoperability and added value to existing programmes. The published traceability statement's historic target date is not evidence that nationwide implementation was completed.

Pilot one category with usable unit serials, one manufacturer, a distributor and a small retailer cohort. Evaluate integration time, packing reconciliation, added labour, successful consumer lookups, false positives/negatives, weak connectivity, non-smartphone access and cost per verified unit. Include imports, legitimate informal/secondary distribution, returns, recalls and dispute resolution in the rollout design. Bottled water, medicines and other product classes have different margins, identifiers, safety needs and line speeds.

For a regulator-facing deployment, establish who accredits participants and evidence sources, who can approve/correct custody, who controls keys, what consumers versus inspectors can see, and how findings lead to investigation or enforcement. A good score cannot substitute for inspection/testing of product contents. Government adoption is a validation and governance process, not a consequence of using blockchain.

Recommended decisions:

1. Unique unit identity is required for an individual-authentication claim; batch-only coverage must be labelled as limited.
2. SmartScan carton labels are supported, with existing unique logistics IDs allowed as aliases where appropriate.
3. Packing membership and split handling are mandatory if unit retailer provenance is claimed.
4. No custody auto-claim based solely on participant registration and possession of a public QR.
5. Use signed sender authorization and receiver acceptance; select on-chain publication versus witnessed/anchored event storage after the pilot requirements and costs are understood.
6. Build an evidence/rule service with explicit uncertainty first; calibrate any numerical authenticity score before making probability claims.
7. Correct current consumer verdict/status errors and wire existing anomaly checks before extending the visual score interface.

## Sources checked

- Repository source paths cited above; audit dated 7 November 2026.
- GS1 EPCIS 2.0.1 standard: https://ref.gs1.org/standards/epcis/2.0.1/ (parent/child identifiers and aggregation events).
- NAFDAC traceability statement: https://nafdac.gov.ng/traceability/nafdac-traceability-statement/
- NAFDAC traceability resources: https://nafdac.gov.ng/traceability/traceability-resource-downloads/
- NAFDAC Mobile Authentication Service: https://nafdac.gov.ng/our-services/pharmacovigilance-post-market-surveillance/mobile-authentication-service-mas/
