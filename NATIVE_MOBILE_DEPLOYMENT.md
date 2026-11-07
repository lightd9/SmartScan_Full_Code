# SmartScan native Android and iOS delivery

The mobile deliverables are installed Capacitor applications with bundled assets. Browser/PWA previews remain development aids. Neither app uses a remote `server.url` to load the Vercel website inside its installed shell.

| App | Application ID | Current service status |
| --- | --- | --- |
| SmartScan Verify | `com.smartscan.consumer` | Requests the shared Render assessment API, with explicitly limited registry/direct-chain fallback when the new endpoint is unavailable. |
| SmartScan Enterprise | `com.smartscan.enterprise` | Native projects contain the existing four-role demo. Live enterprise authentication and writes remain a later milestone; setting live mode does not silently use demo inventory. |

## Reusing Vercel and Render

- Keep Vercel for the existing web frontend. No separate Vercel mobile hosting project is required for installed builds.
- Keep Render for the API shared by web, Android and iOS. The configured URL is `https://smartscan-backend-52s4.onrender.com`; its `/healthz` returned HTTP 200 during this work. That check does not validate every production dependency or deploy the new endpoint.
- The supplied Vercel preview address redirected to Vercel sign-in during an unauthenticated check. Native apps do not depend on that preview address.
- Backend updates take effect through Render deployment. Changes to bundled mobile UI/configuration require a new app build and distribution. API compatibility must support already installed app versions.

## Backend release prerequisites for these changes

**Completed on 7 November 2026:** the backend, migration 014 and native-origin settings are live. See [the deployment record](BACKEND_DEPLOYMENT_2026-11-07.md). The steps below remain the release procedure for subsequent updates.

1. Release backend code and its migrations through the existing migration/start process. Rehearse against an isolated copy before changing the deployed database. Migration 014 passed a PostgreSQL 18 rehearsal using a backup of the existing database, then was applied by Render startup.
2. Preserve existing `ALLOWED_ORIGINS` entries and add the exact native origins `https://localhost` (Android) and `capacitor://localhost` (iOS). The updated runtime validator permits the exact iOS origin; it still rejects arbitrary custom schemes, wildcard origins and insecure HTTP production origins. Keep `WALLET_LINK_ORIGIN` as its existing HTTPS website origin.
3. Verify `POST /v1/assessments`, `GET /v1/assessments/:serialNumber`, uploads/images and existing web flows against the same configured chain/contract. Confirm JSON responses rather than authentication redirects or HTML error pages.
4. Check a native request's CORS preflight from each platform. CORS is not user authorization: enterprise account/facility checks must still be enforced server-side when its live adapter is implemented.

Example origin list, substituting the actual public web domain:

```text
ALLOWED_ORIGINS=https://your-existing-web-domain,https://localhost,capacitor://localhost
```

Do not put database credentials, wallet secrets or release signing credentials into mobile `VITE_*` variables. Those values are visible in the installed application. Consumer public settings are documented in [its environment example](smartscan-mobile-consumer/.env.example); the current defaults use Sepolia. A health check does not establish a production-network launch.

## Android

Prerequisites: Node/npm, Android SDK with the platform required by `android/variables.gradle`, accepted SDK licences, and a working Java 21 JDK. The helper prefers a valid `JAVA_HOME`, then Android Studio's JDK or the isolated SmartScan JDK cache on Windows. It does not alter machine-wide Java settings.

From either mobile app directory:

```sh
npm ci
npm run build:android
```

The helper builds the assets, syncs Android and runs Gradle with bounded workers. Installable development APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Both Android debug APKs have been built locally and their signatures verified. Links and checksums are recorded in [implementation validation](SMARTSCAN_IMPLEMENTATION_VALIDATION.md#android-development-artifacts). The enterprise build remains a demo; neither APK has yet been tested on a physical Android device.

Install on a connected test device using `adb install -r <APK path>`, or transfer the APK to an Android phone and install it through the device's package installer. Debug signing is for development distribution.

For Google Play, configure an organization-controlled upload signing key using Android Studio/CI secret storage, then build an Android App Bundle (`npm run build:android:bundle`). Verify signing, version codes and the store's current target-SDK requirements before upload. Do not commit a keystore or its password. Generating an unsigned release bundle is not a completed store release.

## iOS

Cloud build configuration is now in `codemagic.yaml`, with separate simulator checks and signed TestFlight workflows for each app. See [iPhone builds from Windows](IOS_CLOUD_BUILDS.md) for the account/signing setup and the first run. No cloud build or TestFlight upload has run yet; the Apple Developer membership still needs to be set up.

Both applications have Xcode projects. Windows can build/copy the web assets with:

```sh
npm run prepare:ios
```

Compilation, signing and device distribution require a Mac (local or a macOS build runner), Xcode and CocoaPods. On that environment, run `npm ci`, `npm run build`, `npx cap sync ios`, then open `ios/App/App.xcworkspace`. Select the correct Apple development team and signing identity for the app's bundle ID. Test on an actual iPhone before archiving.

Apple Developer Program membership and App Store Connect access are needed for TestFlight/App Store distribution. Local developer-device testing has different Apple signing limits. The Windows asset-copy step does not produce a signed `.ipa` or validate the Xcode build.

The consumer project declares camera access. Enterprise declares camera access and location-when-in-use for operation evidence; it never requires background location. Test allow/deny, reopening the app, scanning from photos, camera release on navigation and optional-location fallback on each OS.

## Release validation

- Test the native packages themselves; browser Chromium/WebKit checks only validate the shared UI behavior.
- Confirm first launch, native safe areas, camera permission/denial, scanning, manual entry, API/image access and saved-history reopening.
- Confirm delivered/sold/recalled/unregistered/unavailable results and visible incomplete checks. A saved assessment retains its check time and does not update itself.
- On enterprise, keep demo labelling visible until real authenticated services are connected. Verify receiving, individual sales and captured location independently when live integration is delivered.
- Add privacy/store declarations for camera, optional location and scan/report data as actually collected. Validate signing ownership, release versioning and support procedures before publishing.

The backend was published to Render as commit `c40a93b` on 7 November 2026. The mobile/web frontend changes were not published to Vercel, Google Play or TestFlight by this backend release.
