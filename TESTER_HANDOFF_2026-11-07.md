# SmartScan tester handoff ? 7 November 2026

Completed a connected testing dataset and Android handoff for Manufacturer ? Supplier ? Retailer ? Consumer. No app/backend source changes, deployment or rebuild were required for this dataset.

## Package

- ZIP: [SmartScan-Tester-Pack-2026-11-07.zip](<C:/Users/HP/Desktop/SmartScan-Tester-Pack-2026-11-07.zip>)
- Guide: [START HERE.html](<C:/Users/HP/Desktop/SmartScan Tester Pack - 2026-11-07/START HERE.html>)
- Passwords are in ACCOUNT ACCESS - private.txt inside the private package, outside Git. No administrator credentials, wallet private keys or infrastructure secrets are included.
- Both existing development-signed Android APKs, nine product images, ten QR PNGs, printable labels PDF, guide PDF, feedback CSV, public manifest and APK checksums are included.
- iPhone/TestFlight distribution is not included; Apple Developer membership and signing are still needed.

## Accounts

| Role | Username | Wallet code | Facility ID | Public wallet |
| --- | --- | --- | --- | --- |
| manufacturer | aster.test | AST-T01 | 8 | 0x7E7696211C9566DfD66C84C3D8A34Fd9ec54D089 |
| supplier | meridian.test | MER-T01 | 9 | 0x8433C773DA2bf7E667ad5CFf4794389271CEA949 |
| retailer | wellside.test | WEL-T01 | 10 | 0x5720762777F6a77205eaCAC476CCbe51ca34D013 |

Each account has its own new encrypted facility wallet, confirmed on-chain role and initial 0.005 Sepolia ETH funding. Existing wallets were not reassigned: the previous supplier and retailer wallets have custody history, and a fresh set avoids inherited stock and identity attribution.

Admin account/password/role/profile remained unchanged, verified by comparing a hash of the full admin auth/profile rows before and after provisioning. Existing accounts and product custody histories were preserved.

## Starting samples

| No. | Product | Starting state | Serial |
| --- | --- | --- | --- |
| 01 | Daily hydration serum | Aster / ready to dispatch | SS-52752052-e6c9-44f5-85b6-284e25baae50 |
| 02 | Vitamin C tablets | Meridian / incoming delivery | SS-7e83b36e-c92b-4013-857a-8168a342bae4 |
| 03 | First aid essentials | Meridian / in custody | SS-90f66346-58c4-429a-99c4-b8c5e96f9960 |
| 04 | Gentle cleansing gel | Wellside / incoming delivery | SS-2711c124-7ad2-4ead-8030-c0232f483e6b |
| 05 | Soothing skin cream - Unit A | Wellside / ready for individual sale | SS-74d4e88b-a18c-45f6-9fde-40fd4b51ef9a |
| 06 | Soothing skin cream - Unit B | Wellside / ready for individual sale | SS-615d3c24-e981-4e5a-8ebc-77f3c18853df |
| 07 | Travel care essentials | Wellside / already sold | SS-fcb2a149-40ca-4c00-b7f5-a3188cb67dac |
| 08 | Daily mineral complex | Aster / recalled example | SS-35661d7a-9eb7-4cf4-b67c-329878f555e5 |
| 09 | Electrolyte sachets | Aster / awaiting blockchain registration | SS-a0000ba3-89ce-41f9-b033-b616b80a6d1f |
| 10 | Unknown identifier test | Unregistered identifier; expect Not found | SS-7af93c13-1017-470e-90c7-e414fe7850c2 |

There are nine database products: eight are chain registered; sample 09 intentionally awaits registration. QR 10 is an additional unknown-identifier test, not a database product. Setup used seven API operations containing **28 confirmed product transactions**, including real open dispatch, receipt, sale and recall. Stable request IDs and saved payloads prevent duplicate operations if setup is resumed.

All product artwork and names are explicitly synthetic. Seed locations use source=profile with fictional Nigerian facility addresses; no device GPS was fabricated. Cartons are standalone registered packages and do not represent a production integration or unit aggregation.

## Verification

- Verified on 2026-11-07T20:06:44.844Z.
- Actual password authentication and active, funded chain-role checks passed for all three accounts.
- All nine initial product states, custodians and history versions matched in each authenticated snapshot; no snapshot warnings or private signing fields appeared.
- Live consumer assessment checks passed for all ten identifiers: 01?06 REGISTERED, 07 SOLD, 08 RECALLED, 09?10 NOT_FOUND. Retailer custody matched Wellside where expected.
- All nine uploaded images were fetched from the backend and matched their source SHA-256 hashes.
- All ten exported QR PNGs were decoded using the same html5-qrcode library as the app and matched their intended verification URLs.
- Installed Android Enterprise: each new login and wallet home passed; Inventory search ASTER showed Manufacturer 9, Supplier 6 and Retailer 4 items.
- Installed Android Consumer: manual verification displayed REGISTERED, SOLD, RECALLED and NOT_FOUND with live assessment data. Previous device scan history was restored.
- The emulator briefly showed a System UI not responding dialog during initial screenshots, and an initial consumer check did not meet the full-assessment assertion. The subsequent completed consumer run passed all four states. These were not resolved by an app rebuild.

## Shared test environment

The backend remains shared. The older open shipment testproduct12 is visible to eligible supplier/retailer accounts by design. The guide tells the tester to search ASTER and leave that shipment untouched; dashboard incoming totals may include it. Facility directories also retain existing businesses.

Tests change connected data permanently; there is no offline-demo reset. Sample 01 is reserved for a complete journey, 02?04 for incoming/dispatch tests, 05 and 06 for proving a single sale does not sell both, 07 for an already-sold result, 08 for a recall result and 09 for registration. For repeat rounds, create new products through the test manufacturer.

API: https://smartscan-backend-52s4.onrender.com
Network: Sepolia, chain ID 11155111
Contract: 0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96

Private resumable setup state and helper scripts remain outside Git at C:/Users/HP/AppData/Local/Temp/smartscan-tester-setup-20261107. Do not share that working directory; only share the prepared handoff ZIP.

## APK hashes

- Android/SmartScan-Enterprise.apk: 9c56a62c3d1f7466a7230d0f25bf7e5a2da1e9cb0b820df3cda1802141028ef7
- Android/SmartScan-Consumer.apk: 526146ae111da442ed9de007e884a7eea1938ce051e4eab919615e6e59b94d1f
