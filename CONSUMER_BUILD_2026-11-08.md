# Consumer verification UI build — 8 November 2026

Consumer **1.1.1-testing**, Android version code **3**, packages commit `9ae81acf447355a2c53741bc2c96a894b0e9f4be` on `build/native-ios-checks`. Enterprise remains at 1.1.0-testing (version code 2). The live backend, database, wallets and contracts were not changed for this UI release.

## Included changes

- A fresh registered scan opens the purchase questions inside the floating product card. Both answers are explicit; the evidence score stays hidden until submission. Current recall and concern notices remain visible while answering.
- An unfinished saved scan in History offers **Finish verification**. List view shows **Two quick questions**. Either opens the questions in the floating card. Force-stopping and reopening the app preserves this fallback.
- Submission replaces the form with the result in the same card, preserving the original scan observation ID. Purchase details can be edited from **View checks**. Network errors retain the current form answers; optional location denial does not fabricate GPS evidence.
- Primary buttons and selected navigation icons use charcoal/grey; the scanner retains its blue accent.
- Product journey order is product name, serial number, verification findings, supply chain, then detailed checks and points.

## Validation

- Consumer tests: 17 passed.
- WebKit and Chromium: required answers, hidden initial score, restarted History and list fallbacks, retry, edit, optional GPS denial, recall, navigation cancellation and journey order passed. Layout checks covered 320, 393, 768 and 960 CSS-pixel widths.
- Android: Vite bundle, Capacitor sync and Gradle debug build succeeded. APK metadata is `com.smartscan.consumer`, version code 3, `1.1.1-testing`. Packaged assets contain the live HTTPS API and updated flow, with no preview server URL.
- APK installed over the previous Consumer app on `emulator-5554` without uninstalling or clearing its data.
- Native live test using the existing sold sample 04: fresh questions, force-stop/relaunch fallback, 90/100 passing result in History, one saved product with the original observation ID, and the required journey order all passed. No custody or sale operations were performed.
- Codemagic iOS simulator build [`6aefbb547fbe5e6e1bf3cd89`](https://codemagic.io/app/6aef1bf2673f1985aeb9c4fe/build/6aefbb547fbe5e6e1bf3cd89) succeeded for the same source commit using Xcode 26.6 and CocoaPods 1.16.2. Simulator ZIP and build logs were downloaded and checked.

## Local tester files

Updated pack: `C:\Users\HP\Desktop\SmartScan Workflow Tester Pack - 2026-11-08`.

The pack contains the new Consumer APK, unchanged Enterprise APK, existing labels/accounts, updated HTML/PDF instructions, checksums and validation records. The 7 November pack is preserved. The tester credentials remain private and have not been sent to anyone or committed to Git.

The Android APK uses development signing for testing. The iOS output is an unsigned simulator app for a compatible Mac, not an installable iPhone IPA. Signed TestFlight distribution still requires the owner's Apple Developer membership and signing setup. Backend scoring policy and the other pilot limitations remain as documented in [the workflow release](SMARTSCAN_WORKFLOW_RELEASE_2026-11-07.md).
