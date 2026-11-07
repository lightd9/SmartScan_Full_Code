# Mobile layout improvements — 7 November 2026

Both installed apps now fill the available window at every width. The former 440px phone preview frame no longer constrains tablet, unfolded, or wider iOS windows. Layout decisions use the available viewport, not a device model.

## Changes

- Enterprise sign-in has its own layout: brand and introduction, labelled field groups, a full-width submit button, password visibility control, and separated wallet guidance. Auto margins center it when space allows; short windows scroll from the top.
- At 700px and above, Enterprise uses adjacent dashboard panels, two-column inventory, product details beside the journey, and camera capture beside the scan session. Registration forms remain bounded for readability.
- Consumer places scanner controls beside the camera on wider screens. Product history places the map beside the selected product or list. Small cover screens retain a single-column layout and reachable shortcuts.
- At 1024px and above, with at least 600px of height, both apps use a navigation rail. Smaller and short landscape windows retain bottom tabs.
- Sheets are bounded on larger screens, scroll within the available height, and preserve room for safe areas. Wallets, serials, and longer content can wrap.
- The carousel aligns the selected card again after a resize. The map fits its route to its actual visible pane. CSS changes do not remount camera components or reset forms.
- Android activities explicitly allow resizing. Existing native Android insets and IME resizing remain in place. Shared visual-viewport handling accommodates keyboards that overlay WKWebView/browser content, preserves button position during keyboard dismissal, and does not mistake pinch zoom for a keyboard.

## Verification

Chromium and WebKit were checked at these CSS viewport sizes:

| Narrow / phone | Intermediate / unfolded | Tablet / landscape |
| --- | --- | --- |
| 320 × 568 | 600 × 720 | 1024 × 768 |
| 344 × 882 | 700 × 840 | 1280 × 800 |
| 390 × 844 | 768 × 900 | 844 × 390 |
| 412 × 892 | 853 × 720 | 568 × 320 |

The sweep covered sign-in, all four Enterprise roles, inventory, scanning, registration, passport, review, wallet and manual-entry sheets, plus Consumer scanner, history/carousel/list, journey, reports, report form, and settings. There were 756 layout measurements with no horizontal-clipping findings. Five Chromium measurements captured the previous viewport height during resize; all five passed when rechecked after the browser committed the new viewport. WebKit passed the initial sweep.

Additional checks passed for:

- Sign-in success/error using intercepted responses and local fixtures; password visibility and retained field values.
- Selected carousel item, scan-session item, registration draft, and manual-entry text surviving resizing.
- Fake camera streams remaining live with the same track identity through folding-sized, phone, and landscape resizes in both apps (Chromium).
- Injected safe areas and overlay-keyboard geometry, keyboard focus handover, restoration after dismissal, and pinch-zoom exclusion in Chromium and WebKit.
- Representative 150% text-size checks on sign-in and Consumer settings.
- Enterprise: 27 existing tests and TypeScript checks. Consumer: 13 existing tests.

All browser test data used disposable contexts. No product, custody, wallet, or other live backend mutation was performed for layout testing.

Local browser scripts, measurement output, and screenshots are in `C:\Users\HP\AppData\Local\Temp\smartscan-browser-check\responsive*`.

## Device coverage

These are responsive viewport and engine checks, not certification on physical foldables. Physical crease/hinge behavior, manufacturer-specific multi-window behavior, system text scaling, and an installed iOS build still need device testing. No dimensions or capabilities were assumed for an unreleased iPhone model. Separate displays with a physically occluding hinge may require a native window-segment integration; the current layouts adapt to the window supplied by the OS.

iOS orientations already allow portrait and landscape. Updated web assets are prepared for the existing native iOS projects; a signed iOS distribution build is a separate step.

## Android artifacts

Both `npm run build:android` builds completed successfully. APKs are under each app's `android/app/build/outputs/apk/debug/app-debug.apk`.

Both APKs were installed successfully with `adb install -r` on the existing Pixel_6_Pro Android emulator. Native WebViews filled the 412 × 892 CSS viewport with no horizontal overflow. Resizing the emulator to 768 × 892 changed both apps to their wider layouts; Enterprise retained its in-memory marker and entered username, confirming no reload during the resize. The emulator was restored to its original 720 × 1560 physical override afterward. These native checks exercised resizing, not a physical folding hinge.

The native Android keyboard also reduced Enterprise's visible viewport from 892px to 560px while the username field remained focused. Browser keyboard checks separately covered reaching the submit controls. Android's launcher retained its tablet taskbar after the size override was restored, so the emulator was restarted after the test to restore its phone configuration.

| App | SHA-256 |
| --- | --- |
| Enterprise | `9c56a62c3d1f7466a7230d0f25bf7e5a2da1e9cb0b820df3cda1802141028ef7` |
| Consumer | `526146ae111da442ed9de007e884a7eea1938ce051e4eab919615e6e59b94d1f` |

The Consumer production build retains its existing large-JavaScript-chunk warning; it did not prevent the build. Backend deployment was not needed for these UI changes.
