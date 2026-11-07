# SmartScan Enterprise mobile

An interactive, local-data preview of the Admin, Manufacturer, Supplier, and Retailer workspaces. It follows the consumer application's navy design system.

**This build is a demo.** It has no live authentication, backend connection, blockchain writes, payment processing, or real facility wallets. The demo label stays visible. Sample businesses and serialized products are generated locally; no real operational data is fetched. Setting `VITE_DATA_MODE` to anything except `demo` displays a connection-not-configured screen rather than falling back to fixtures.

## Run

Use Node 22.12+ (the repository uses Node 24).

```powershell
npm ci
npm run dev:https
```

Open `https://localhost:5181` on this computer. On the same Wi-Fi/network, use the LAN address printed by the server, such as `https://172.20.10.5:5181`.

The HTTPS script reuses the local development CA from the consumer app. If it is already trusted on your iPhone, no new CA installation is required. A first-time certificate download is available at `http://<LAN-IP>:5182/smartscan-dev-ca.cer`. On iPhone, install it under Settings > General > VPN & Device Management, then enable trust under General > About > Certificate Trust Settings. The CA private key stays outside the project and is never served.

`npm run dev` serves an HTTP preview on port 5180; localhost camera access works, but a phone's LAN camera access needs HTTPS. The consumer app uses separate ports and remains independent.

## Explore

Select a role on the welcome screen. The role name at the top returns to this selector. Use the facility code beside the wordmark to change location. Existing scan drafts and operations are scoped to their facility.

Recommended first walkthrough:

1. Select Supplier and open Receive a delivery.
2. Use Try demo items to add Paracetamol and Vitamin C. Add Electrolyte sachets to see a wrong-recipient exception, or Daily mineral complex to see a recall.
3. Review the eligible items and confirm receipt. Reload while recording to verify recovery.
4. Use Prepare dispatch, review, and choose Victoria Island store as the destination.
5. Switch to Retailer, receive those dispatched items, and record a sale. The confirmed operation provides a demo receipt.

Dispatch reviews start with **Open dispatch** selected. Any eligible downstream facility can claim receipt; choosing a named facility restricts receipt to that destination. Each new review starts open, even if a previous dispatch used a named facility.

To sell just one item, open **Inventory > In custody > product > Sell this item** and confirm its single-item review. This does not add other items from a saved sale session. Alternatively, use **Scan > Sell > Choose from inventory** or scan labels, then **Review** and tick the items for this sale. Session reviews begin with nothing selected; Select all is available for a larger sale. The confirmation button shows the selected count. Unselected items remain in custody and in the saved session.

More > Demo scenarios offers normal, empty, partial-completion, and offline scenarios. Replacing a scenario resets local demo records. In the partial scenario, Vitamin C fails once; completed items remain saved and only the failed item needs another review. Offline mode permits capture and preserves drafts but blocks recording.

Manufacturer supports a saved registration form, optional product photo, registration progress, printable QR label, dispatch, and recall. Admin supports business/facility creation, explicit approval/revocation, operation history, and sample scan-alert inspection. Revocation blocks pending and future demo actions and cannot silently restore a facility.

Use real camera codes from the demo QR labels or enter a canonical serial. `SS-00000000-0000-4000-8000-000000000001` is the first sample incoming product. Only canonical serials and URLs at the configured verification origin are accepted. Sample serials do not represent live registrations.

## Architecture

- `src/domain`: typed product stages, workspace identity, custody capabilities, recipient eligibility, and QR parsing.
- `src/services`: the interface a future live adapter must implement.
- `src/dev`: fixtures and the local demo service. Operations persist before completion, use stable request IDs, recheck current eligibility, and retain individual outcomes.
- `src/app`: session/facility context, route shell, query cache, and refresh handling.
- `src/design`: shared presentation, sheets, palette, and responsive styles.
- `src/features`: workspaces and operational screens.
- `src/platform`: camera lifecycle, image decoding, and optional feedback.

The local simulator models recovery inside this preview, not production transaction durability or concurrency guarantees. It runs on one browser's storage and cannot synchronize devices. Live integration needs server-side operation IDs, idempotency, custody indexing, receipt persistence, and signer coordination as specified in [the implementation plan](../ENTERPRISE_MOBILE_PLAN.md).

This milestone uses frontend filtering of a small fixture dataset. A live adapter must enforce account/facility scoping and pagination on the server. Role previews are not production authorization.

## Validation and native follow-up

```powershell
npm test
npm run build
```

Unit tests exercise contract-derived permission boundaries and local operation recovery, duplicate submission, partial completion, and revocation. TypeScript is strict, including unused imports. Routes and camera decoding are split into separate chunks.

`capacitor.config.ts` defines the enterprise app identity. Native Android and iOS projects are now generated. `npm run build:android` builds an installable Android demo; `npm run prepare:ios` copies bundled assets into the Xcode project. iOS compilation/signing requires macOS, Xcode and Apple signing access. Live authentication, secure session storage, physical-device lifecycle validation and printer integrations remain later work. See [native deployment instructions](../NATIVE_MOBILE_DEPLOYMENT.md).

Print/save buttons use browser/system printing and dedicated label/receipt layouts. They do not connect directly to a Bluetooth printer. Haptics run only on supported native builds; scan sounds are optional. Browser camera access is supported in the HTTPS preview.

New business actions also capture device location with permission and preserve a labelled profile fallback when unavailable. See [LOCATION.md](LOCATION.md) for the recorded fields, history behavior, and limits.
