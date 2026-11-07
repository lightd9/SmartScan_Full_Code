#!/usr/bin/env bash
# Run from one mobile app directory on a Codemagic macOS worker.
set -euo pipefail

fail() { echo "$*" >&2; exit 1; }
mode="${1:-simulator}"
case "$mode" in
  simulator|testflight) ;;
  *) fail "Usage: build-ios-codemagic.sh simulator|testflight" ;;
esac
[[ "$(uname -s)" == Darwin ]] || fail "iOS compilation requires a macOS worker with Xcode."

case "$(basename "$PWD")" in
  smartscan-mobile-consumer) expected_bundle=com.smartscan.consumer ;;
  smartscan-mobile-enterprise)
    expected_bundle=com.smartscan.enterprise
    [[ "${VITE_DATA_MODE:-demo}" == demo ]] || fail "Enterprise live services are not implemented; this workflow requires demo mode."
    ;;
  *) fail "Run this script from a SmartScan mobile app directory." ;;
esac
[[ "${BUNDLE_ID:-}" == "$expected_bundle" ]] || fail "BUNDLE_ID does not match the selected app."
[[ "${IOS_MARKETING_VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Set IOS_MARKETING_VERSION to a version such as 1.0.0."
if [[ "$mode" == testflight ]]; then
  [[ "${APP_STORE_APPLE_ID:-}" =~ ^[1-9][0-9]*$ ]] || fail "Set APP_STORE_APPLE_ID in this app's Codemagic environment group."
  [[ "${PROJECT_BUILD_NUMBER:-}" =~ ^[0-9]+$ ]] || fail "Codemagic PROJECT_BUILD_NUMBER is required for unique build numbering."
fi

# Commit-lockfile installs, then native sync installs the required CocoaPods.
npm ci
npm test
npm run build
npx cap sync ios
node --input-type=module <<'NODE'
import { readFileSync, existsSync } from 'node:fs';
const config = JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8'));
if (config.appId !== process.env.BUNDLE_ID || config.server?.url) {
  throw new Error('The native app must have the expected bundle ID and bundled assets.');
}
if (!existsSync('ios/App/App/public/index.html')) throw new Error('Bundled UI is missing.');
NODE

mkdir -p build/ios
xcodebuild -version | tee build/ios/toolchain.log
pod --version | tee -a build/ios/toolchain.log
git rev-parse HEAD | tee -a build/ios/toolchain.log

if [[ "$mode" == simulator ]]; then
  xcodebuild \
    -workspace ios/App/App.xcworkspace \
    -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath build/ios/DerivedData \
    CODE_SIGNING_ALLOWED=NO \
    "MARKETING_VERSION=$IOS_MARKETING_VERSION" \
    build | tee build/ios/simulator-build.log
  simulator_app=build/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app
  actual_bundle=$(plutil -extract CFBundleIdentifier raw -o - "$simulator_app/Info.plist")
  [[ "$actual_bundle" == "$BUNDLE_ID" ]] || fail "Unexpected simulator bundle ID."
  ditto -c -k --sequesterRsrc --keepParent "$simulator_app" "build/ios/$BUNDLE_ID-simulator.zip"
  echo "Simulator compilation passed. This artifact cannot be installed on an iPhone."
  exit 0
fi

# A failed Apple API lookup aborts the build. Only a successful empty lookup
# (a new version with no uploads) starts at zero. Never mask auth/network errors.
latest=$(app-store-connect get-latest-testflight-build-number "$APP_STORE_APPLE_ID" \
  --platform IOS --pre-release-version "$IOS_MARKETING_VERSION")
latest="${latest:-0}"
[[ "$latest" =~ ^[0-9]+$ ]] || fail "Existing Apple build number is not an integer; review the numbering policy before uploading."
next_build=$((10#$latest + 1))
project_build=$((10#$PROJECT_BUILD_NUMBER + 1))
if (( project_build > next_build )); then next_build=$project_build; fi
(( next_build <= 9999 )) || fail "Build counter exceeds this workflow's integer version range. Update the numbering policy."

# Apply only this app's profiles; the repository contains two iOS projects.
xcode-project use-profiles \
  --project ios/App/App.xcodeproj \
  --export-options-plist build/ios/export_options.plist
xcode-project build-ipa \
  --workspace ios/App/App.xcworkspace --scheme App --config Release \
  --archive-directory build/ios/xcarchive \
  --ipa-directory build/ios/ipa \
  --export-options-plist build/ios/export_options.plist \
  --archive-xcargs "CURRENT_PROJECT_VERSION=$next_build MARKETING_VERSION=$IOS_MARKETING_VERSION" \
  | tee build/ios/archive-build.log

# Publication is handled by codemagic.yaml only after this script succeeds.
shopt -s nullglob
ipas=(build/ios/ipa/*.ipa)
(( ${#ipas[@]} == 1 )) || fail "Expected exactly one exported IPA."
shasum -a 256 "${ipas[0]}" | tee build/ios/ipa-checksum.log
echo "Exported $BUNDLE_ID $IOS_MARKETING_VERSION ($next_build) for TestFlight processing."
