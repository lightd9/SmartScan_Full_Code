# iPhone builds from Windows

Configured 7 November 2026. The repository now contains manual Codemagic workflows for both Capacitor apps. Configuration has been checked locally; no cloud Xcode build, Apple signing operation or TestFlight upload has run yet. An Apple Developer membership has not yet been set up.

## Start now: check iOS compilation without Apple membership

1. Create/sign in to your account at [Codemagic](https://codemagic.io/) and connect the GitHub repository `lightd9/SmartScan_Full_Code`. Review the service's current macOS build allowance/pricing in your account.
2. Select the Git branch **`build/native-ios-checks`**. It packages the current mobile implementations, both native iOS projects, their package lockfiles, shared test fixtures, `codemagic.yaml`, and `scripts/build-ios-codemagic.sh`. This dedicated branch keeps mobile build validation separate from the deployed backend on `main`.
3. Add the repository as a **codemagic.yaml** application. Use the YAML file at the repository root; it sets the correct working directory for each app.
4. Start `ios-consumer-simulator`, then `ios-enterprise-simulator`, from that branch. These workflows do not reference Apple keys, signing files or App Store variable groups.
5. Check the logs and download the `*-simulator.zip` artifact. This is a compiled simulator `.app` for a compatible Mac simulator, **not an iPhone-installable IPA**. A successful build establishes compilation, not camera or device behavior.

| Workflow | Result | Apple membership |
| --- | --- | --- |
| `ios-consumer-simulator` | Unsigned simulator build of SmartScan Verify | Not needed |
| `ios-enterprise-simulator` | Unsigned simulator build of SmartScan Enterprise demo | Not needed |
| `ios-consumer-testflight` | Signed consumer IPA uploaded to App Store Connect | Required |
| `ios-enterprise-testflight` | Signed enterprise demo IPA uploaded to App Store Connect | Required |

All workflows are manual. There are no push triggers. The signed workflows upload builds for internal TestFlight testing; they do not submit to beta review or public App Store review. After Apple finishes processing, assign the build to an internal TestFlight group in App Store Connect. External testers require a separate beta review/distribution setup.

### Starting builds from the development tools

Connecting GitHub allows Codemagic to clone the repository; it does not authenticate this PC to the Codemagic API. To let the development tools start and monitor builds, obtain a personal API token from **Codemagic > Account settings > API token** and store it outside Git as the Windows user environment variable `CM_API_TOKEN`. Do not paste it into chat or put it in `codemagic.yaml`. Windows Settings > System > About > Advanced system settings > Environment Variables > User variables > New can set this value without including it in shell history.

The alternative needs no local API token: open the repository in Codemagic, select **Start new build**, choose branch `build/native-ios-checks`, and run the two simulator workflow IDs listed above. If the repository has not been added as an application yet, add `lightd9/SmartScan_Full_Code` and select configuration through `codemagic.yaml` first. GitHub connection alone does not necessarily add the application.

## Enable installation on your iPhone

1. Enrol in the [Apple Developer Program](https://developer.apple.com/programs/enroll/). Choose the account/legal owner that should own SmartScan. Organization enrolment has separate legal-entity requirements. Complete Apple's agreements and activation before configuring signing.
2. In Apple Developer, register two explicit App IDs. These identifiers must be available under your Apple team; if already taken, update the Capacitor, Android and iOS project identifiers and workflow configuration consistently before registration/builds.

   | Product | Current bundle ID | Suggested SKU |
   | --- | --- | --- |
   | SmartScan Verify | `com.smartscan.consumer` | `smartscan-consumer-ios` |
   | SmartScan Enterprise | `com.smartscan.enterprise` | `smartscan-enterprise-ios` |

3. In [App Store Connect](https://appstoreconnect.apple.com/), create an iOS app record for each bundle ID. Record each app's numeric **Apple ID** from App Information. This is different from your Apple login, team ID and bundle ID. Display names are subject to Apple's availability rules.
4. In App Store Connect **Users and Access > Integrations**, request API access if necessary, then create a team API key with the access needed to manage signing and uploads. Codemagic's signing setup uses an **Admin** key. Download the `.p8` file once and retain it securely; also record its Key ID and Issuer ID.
5. In Codemagic **Team settings > Integrations > Developer Portal**, add that key with the exact reference name **`smartscan-apple`**. Upload the private key directly into Codemagic, not this repository or a chat message.
6. In Codemagic **Code signing identities**, generate or upload an **Apple Distribution** certificate with its private key. When generating through Codemagic, download the certificate/password and upload the certificate back into its signing storage as instructed by the service. Keep a secure owner-controlled backup. An API key alone is insufficient to sign an app.
7. Create an **App Store Connect** distribution provisioning profile for each registered bundle ID using that certificate in Apple Developer. Fetch/upload both profiles into Codemagic. Confirm each profile has a matching certificate. One suitable distribution certificate can sign both apps; each app needs its own profile. The YAML selects stored identities by bundle ID and `distribution_type: app_store`.
8. Create these Codemagic environment variable groups:

   | Group | Variable | Value |
   | --- | --- | --- |
   | `smartscan_consumer_app_store` | `APP_STORE_APPLE_ID` | Consumer app's numeric Apple ID |
   | `smartscan_enterprise_app_store` | `APP_STORE_APPLE_ID` | Enterprise app's numeric Apple ID |

9. Run `ios-consumer-testflight`. The script tests the app, bundles the screens, syncs CocoaPods, applies the selected profile and exports a signed IPA. Codemagic uploads the artifact through the `smartscan-apple` integration. Then repeat for enterprise.
10. In App Store Connect, resolve any processing/export-compliance questions accurately for the app's actual encryption use. Create an internal TestFlight group, add your eligible App Store Connect account and assign the processed build. Install [TestFlight](https://apps.apple.com/app/testflight/id899247664) on your iPhone and accept the invitation. Apple processing can take time; a successful IPA export is not confirmation that Apple has accepted it.

SmartScan Enterprise is the product name, not Apple's Enterprise distribution program. Both apps use the ordinary Apple Developer Program and TestFlight for this testing phase. Its backend services remain visibly in demo mode.

## What the build does

- Uses Node 24, the service's latest stable Xcode image and its default CocoaPods. Toolchain versions and Git commit are logged with each build; pin a tested Xcode version in `codemagic.yaml` after the first successful cloud run.
- Uses `npm ci` with each committed lockfile, runs existing tests, builds the web assets, then runs `npx cap sync ios`. Sync performs native dependency installation; Windows `prepare:ios` does not replace this macOS step.
- Uses the committed shared `App` schemes and verifies the bundled Capacitor configuration has the correct app ID, local UI assets and no remote `server.url`.
- Keeps enterprise in demo mode and the consumer on the existing Sepolia configuration. This setup is for testing, not a production-chain launch. Review `codemagic.yaml` public variables before changing the API or network; `VITE_*` values are visible inside the installed app.
- Keeps certificates/private keys in Codemagic, selects only the current app's Xcode project when applying profiles, and stops on test/build/signing failures.
- Uses the larger of the next TestFlight build number for the selected version and Codemagic's next project build number. Apple lookup failures stop the build. Run at most one signed build per app/version at a time and wait for Apple processing before retrying an upload; the remote lookup cannot reserve a number against concurrent external builds. Dotted legacy build numbers or counters over 9999 require a numbering-policy update rather than silently guessing.
- Uploads IPA, dSYM, logs and the resolved Podfile.lock as artifacts. The simulator workflow uploads a simulator ZIP instead. After the first successful native sync, retain/review the generated Podfile.lock for reproducible future dependency resolution.

## Render and the existing database

The mobile apps call the existing Render API over HTTPS. They do not connect directly to PostgreSQL, and there is no separate mobile database. The Render configuration obtains its existing database connection through `DATABASE_URL`; this file does not establish which provider physically hosts the deployed database.

The shared assessment code and migration 014 are now deployed to **the existing Render service**, with both `https://localhost` and `capacitor://localhost` added to its allowed origins. Live readiness and both native preflights passed on 7 November 2026. The earlier iOS HTTP 403 is resolved. See [the backend deployment record](BACKEND_DEPLOYMENT_2026-11-07.md).

Migration handling depends on the deployed start configuration:

- `render.yaml` and `npm start` run `node migrate.js && node postgres.js`.
- `render.prod.yaml` starts the web process with `node postgres.js`; run the reviewed migration separately through the existing release process before starting the new code. Do not assume this production blueprint automatically applies migration 014.

Follow [Native Mobile Deployment](NATIVE_MOBILE_DEPLOYMENT.md#backend-release-prerequisites-for-these-changes) for subsequent staging/migration/API validation. The backend release used authenticated Render settings and the existing Git deployment; editing this cloud-build YAML alone does not update the live backend.

## First iPhone check

Check camera allow/deny and reopening, scanner release when switching screens, manual lookup, safe areas and the home indicator, Render API/images, saved history, sold/recalled/unavailable results and evidence details. On enterprise, check role selection, receiving and individual sales in the demo. Test optional-location denial as well as approval. Simulator compilation cannot validate the iPhone camera or real permissions.

## Reference documentation

- [Codemagic Capacitor/Ionic setup](https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/)
- [Codemagic signing identities](https://docs.codemagic.io/yaml-code-signing/signing-ios/)
- [Codemagic App Store Connect publishing](https://docs.codemagic.io/yaml-publishing/app-store-connect/)
- [Apple Developer enrolment](https://developer.apple.com/programs/enroll/)
