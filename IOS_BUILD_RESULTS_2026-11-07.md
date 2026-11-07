# SmartScan iOS cloud build results — 7 November 2026

Both mobile applications compiled successfully on Codemagic and produced downloadable simulator packages. Mobile sources and build configuration are published on [build/native-ios-checks](https://github.com/lightd9/SmartScan_Full_Code/tree/build/native-ios-checks). The deployed backend remains on `main`.

| App | Result | Codemagic build |
| --- | --- | --- |
| SmartScan Verify | 13 tests passed, production bundle, CocoaPods sync and Xcode simulator compilation passed; artifacts published | [Consumer build](https://codemagic.io/app/6aef1bf2673f1985aeb9c4fe/build/6aef1d4024e1ec23755728b6) |
| SmartScan Enterprise demo | 21 tests passed, TypeScript check, production bundle, CocoaPods sync and Xcode simulator compilation passed; artifacts published | [Enterprise build](https://codemagic.io/app/6aef1bf2673f1985aeb9c4fe/build/6aef1d4124e1ec23755728b8) |

Built commit: `cb89bc3251262032f51d78593a743fedb57995f8`. Both runs used Mac mini M2 workers, Node 24, Xcode 26.6 (17F113) and CocoaPods 1.16.2. Later documentation and Podfile.lock commits retain these results and the exact resolved dependency graphs; they do not represent another cloud run.

## Packages checked

Downloaded both archives and checked their iOS simulator platform metadata, app IDs, version 1.0.0, permission descriptions and bundled UI assets. Neither loads a remote `server.url`. Enterprise remains in demo mode. Each build also published an archive containing its compiler log, toolchain log and Podfile.lock.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `com.smartscan.consumer-simulator.zip` | 2,377,153 | `14b24face462c3604a5aeb10d505d04e42ed7f6c5f3b4822c605d264a876f454` |
| `com.smartscan.enterprise-simulator.zip` | 1,825,983 | `64dd4d579cb26f0eb570b604c76cd7af289629f87e6e5d0ad61a8118cc176b12` |

Local copies and receipts are under the ignored workspace directories `artifacts/ios/6aef1d4024e1ec23755728b6/` and `artifacts/ios/6aef1d4124e1ec23755728b8/`. Packages and temporary authenticated download URLs are not committed to Git. Use the build links above to access Codemagic's artifacts while they remain within the service's retention period.

Both generated Podfile.lock files were checked against the committed npm versions and Podfile checksums before being retained in the iOS projects. Xcode is pinned to the version used by these successful builds.

## Build issue resolved

The first runs on `599f008` compiled both apps, but Codemagic's publishing step found no artifacts. The workflow now anchors all project artifact patterns to `$CM_BUILD_DIR`. Both repeated runs on `cb89bc3` published their simulator ZIPs and supporting logs successfully. The same path correction applies to the future TestFlight workflows.

## Remaining device checks

These are simulator apps, not signed IPAs and not installable on an iPhone. No simulator interaction, physical-device camera/permission testing, Apple signing or TestFlight upload is claimed by these compilation checks. Apple Developer enrolment and signing setup are still required for TestFlight distribution; see [the setup guide](IOS_CLOUD_BUILDS.md).

Cloud compilation does not enable enterprise live authentication or stock writes. Those remain separate work in [the implementation plan](SMARTSCAN_IMPROVEMENT_PLAN.md).
