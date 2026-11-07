# Interface validation

## Transaction location refinement — 7 November 2026

- Enterprise: all 21 tests pass, including fresh device capture, zero coordinates, denied permission, unavailable profile, failed/slow reverse geocoding, unanswered prompts, late callbacks, and location retention through confirmation/retry/reload.
- Production build passes TypeScript and Vite.
- Dedicated Chromium and WebKit location walkthroughs pass: capture with granted device permission, receipt and journey display, reload, changing a profile address without rewriting history, and a subsequent receipt using a labelled profile fallback after permission denial. Confirmed receipt still determines the custodian. No runtime errors, horizontal overflow, or violations in the targeted axe rules.
- Existing Chromium and WebKit dispatch and individual-sale walkthroughs pass, including open destination defaults and preserving unselected custody/session items. The WebKit check waits for the inventory picker to finish populating before asserting its count.
- Backend: all 91 tests pass, including rejecting invalid location types and enforcing the contract's 200-byte UTF-8 limit before wallet execution.
- Existing web application: all 59 tests and its production build pass, including 8 new location regressions. Vite reports a large main bundle; bundle optimization is outside this location change. Locked dependencies were installed using `npm ci --legacy-peer-deps` because the existing QR-reader package declares an older React peer range; dependency versions and lockfile were not changed.

These checks used simulated browser positions and local demo transactions. They do not verify physical GPS accuracy or live blockchain submissions. See [LOCATION.md](LOCATION.md) for capture behavior and the integration boundary.

## Initial interface review

Reviewed on 6 November 2026 using the local HTTPS demo. These results describe this frontend milestone, not live-service or native release readiness.

- `npm run build`: passes strict TypeScript and Vite production build. Screens and camera decoding are loaded in separate chunks.
- `npm test`: 13 tests pass across custody rules and the persisted demo operation lifecycle, including selling one item without affecting remaining custody/session items and receiving an open dispatch.
- Dependency installation/audit: zero reported vulnerabilities after selecting the patched React Router version.
- Chromium and WebKit walkthroughs: supplier receipt/directed dispatch, duplicate and wrong-recipient handling, recalled-item exclusion, saved sessions, refresh during pending operation, retailer sale/receipt, manufacturer draft/registration/label/recall, and admin business/facility creation/approval/revocation pass.
- Camera checks: simulated camera startup, hint animation, pause/resume for a sheet, stopping tracks when leaving Scan, and decoding a real generated QR photo pass in Chromium. WebKit permission-denied handling passes with a denied-media stub.
- Viewports: 402×874, 375×667, 320×568, and 874×402 checked for viewport width, bottom navigation placement, and scan-review control clearance. Reduced-motion layout checked in WebKit.
- Partial-batch walkthrough: completed items remain recorded; only the failed item returns for review, and its retry does not repeat the completed receipt.
- Targeted axe checks: no violations for text contrast, button names, field labels, and selected ARIA rules across the scanner and 11 additional screens/states. This is not a complete accessibility certification.

Still requires later validation: physical iPhone/Android camera hardware and torch, native lifecycle and secure authentication, actual Bluetooth/USB scanners, printer models, cross-device server state, real wallet signing, contract reconciliation, and backend authorization.

## Device-feedback refinements

After the user's iPhone review, open dispatch now defaults on every new dispatch review. Retailers can sell directly from a product passport, add held stock through the inventory picker, and choose individual sale-session items before confirmation.

- Production build and all 13 tests pass.
- Chromium and WebKit walkthroughs pass: manufacturer/supplier open destination defaults, resetting to open after leaving a named-destination review, optional directed dispatch, retailer receipt of open and directed items, and the new inventory picker.
- Received multiple items and sold only one of three held items. Verified the submitted operation and receipt contain only the selected serial, the other products stay in custody, and unselected serials remain in the saved session.
- Direct "Sell this item" review contains only the requested product even with other eligible items already in the sale queue. A sold serial cannot be sold again through that URL.
- Select all, deselect all, empty-selection blocking, keyboard checkbox selection, reduced motion, 402×874 / 375×667 / 320×568 / 874×402 layouts, and confirmation-button clearance pass.
- Targeted axe checks pass for the open dispatch review, inventory picker, sale selection, and direct single-item review in both browser engines. No runtime errors during the completed walkthroughs.

These refinements have browser-engine coverage; the user should refresh the phone preview to check their device experience.
