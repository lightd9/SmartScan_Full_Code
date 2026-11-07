# Enterprise device-testing batch — 7 November 2026

The user authorized the combined build on 7 November. Both Android debug APKs
have now been rebuilt and installed with `adb install -r`, preserving app data.
The emulator was temporarily shut down during compilation to free memory, then
reopened. No iOS/cloud build or backend deployment was performed in this batch.

## Changes prepared

| Finding | Source change | Validation still needed |
| --- | --- | --- |
| AST-01 header chip and duplicate Enterprise subtitle | Removed subtitle on shell/welcome. Header shows abbreviated facility wallet and opens wallet details plus facility selection. Current wallet is explicitly a sample wallet. | Check narrow-screen layout in the combined build. |
| Print/save label does nothing | Replaced WebView `window.print()` with a standalone QR PNG, exported with Capacitor Filesystem/Share; browser download fallback. Button now says Save / share label. | Native share, cancellation, save, and scan the exported QR on Android/iOS. Direct printer support depends on the selected OS/printer app. |
| Supplier/Retailer label access | Only the owning manufacturer can see/export the passport QR. Removed product QR reprints from sale receipts. User confirmed Manufacturers only. | Verify all four roles in rebuilt app. |
| Subtle feedback for actions on the same screen | Compact 2.8-second toast; repeated identical text restarts the timer. Added Product added/removed, Session cleared, Photo added, Preference saved; shortened account/facility notices. Toast remains visible above sheets. | Check repeated scans and toast positioning with keyboard open. |
| Scanner rejects a product already held | Heading is Scan product. Suggest receipt, dispatch, or sale using current custody and permissions, with a single-product review. Pending, recalled, sold, wrong-facility and inactive-facility states cannot produce an unauthorized suggestion. | Scan a received item while the Receive task is selected. |
| Inventory receipt requires scanning again | Passport Receive this item submits only that item, using stable request key, tap guard and normal service validation/location capture, then opens receipt details. Scanned receipts retain review/confirm. | Verify loading/errors and physical receipt confirmation copy. |
| Other browser-only exports | Manifest CSV and standalone HTML sale receipt use native save/share. Export cancellation does not report a successful save. Dispatch preparation preserves existing scan drafts. | Save/open exports from the native share sheet. |

## Integrated wallet — still outstanding

The installed app and current enterprise service remain DEMO. Changing the
header does **not** wire signing. `src/services/index.ts` and `src/main.tsx`
deliberately reject live mode instead of substituting demo records.

The backend already provides account authentication and automatic signing at
`POST /api/custody/auto-execute`. Completing the mobile connection requires:

1. Real business sign-in and authenticated, account-scoped facility/wallet
   selection. Current demo role selection cannot authorize live transactions.
2. An authenticated endpoint for a business's own facility-wallet status.
   `/api/subaccounts` is currently admin-only, despite an owner-scoped branch
   in its handler. Return public wallet/status/balance fields only.
3. A live enterprise adapter using real inventory, registration/custody status
   and receipts, fully separated from demo stock and local sample wallets.
4. Durable request IDs, submitted transaction hashes and reconciliation of lost
   responses. The existing auto-execute route waits for confirmation and does
   not provide that operation journal; do not blindly retry a timed-out write.
5. Bind each action to its selected authenticated facility wallet. Show actual
   pending/confirmed/failed state, role and gas availability; never fake success.
6. Validate against the existing Render backend/Neon database and Sepolia
   contract. The last deployment report recorded an unfunded gas treasury;
   check its current status before testing any signing.

Found and patched in backend source during inspection: automatic execution
must refuse pending, suspended and revoked facility wallets **before** any
on-chain role grant, gas top-up or private-key access. Non-admin business and
facility roles must match. This patch has not been deployed.

## Checks and deferred native work

- Final Enterprise TypeScript check passed. All 24 domain/service/location
  tests passed, including the new custody, receipt-isolation and label checks.
- All 50 selected backend API/wallet tests passed, including five new
  wallet-permission tests. They use isolated mocks and do not sign or contact
  the live database. Source whitespace and iOS privacy XML checks also passed.
- Added Capacitor 7 Filesystem/Share dependencies and an iOS file-timestamp
  privacy declaration registered in the Xcode resources.
- Android Capacitor sync registered Filesystem/Haptics/Share. Both Android
  builds and APK signature verification passed. Future iOS compilation must
  still sync the new plugins and refresh the Pod lockfile on the Mac worker.
- Device testing found that Android WebView 113 could leave detached-canvas
  `toBlob` pending indefinitely. Label export now uses synchronous PNG encoding
  for the bounded 840×1040 canvas. Enterprise was rebuilt and reinstalled after
  this correction. This was the only source correction during the build pass.
- Previous Android edge-to-edge source changes remain uncommitted. Both native
  apps were checked at a 412×892 CSS viewport: the Enterprise `.device` and
  Consumer `.device-frame` fill the window without horizontal overflow. A new
  foreground Consumer screenshot was captured. Keyboard, rotation and
  three-button navigation still need validation.
- On-device checks passed for direct one-item receipt, contextual dispatch
  review with open destination, Product added toast, Supplier/Retailer label
  restrictions and wallet/branding display. Tests used temporary sample stock;
  original demo storage was restored and compared successfully after each run.
- The final installed Enterprise build generated the PNG and opened the Android
  share sheet with a Print target. A System UI ANR during the last automated
  pass temporarily obscured that sheet; dismissing it confirmed the exported
  image and native options. No physical printer job was submitted. The emulator
  is memory constrained; that final automation pass did not complete its
  keyboard check, so it is not reported as a fully passing run.
- Existing unrelated web frontend edits remain untouched.

## Final Android artifacts

| App | APK size (bytes) | SHA-256 |
| --- | ---: | --- |
| Enterprise | 4,519,571 | `158a06d87dd5336f214d9253f5c2e1e95e97875da323467002556b1472b50ce1` |
| Consumer | 7,249,046 | `a3836caf4ef095ecabe06a564d94e55871770fc5ec34661350ddf41cae576fca` |

Each APK is in its app's `android/app/build/outputs/apk/debug/app-debug.apk`.
These are signed development builds for testing, not store releases.
