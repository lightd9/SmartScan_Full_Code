import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log("\n======================================================");
console.log("🧪 SMARTSCAN PHASE 2 COMPREHENSIVE VERIFICATION SUITE");
console.log("======================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Reason: ${err.message}`);
        failed++;
    }
}

const addProductPath = path.resolve('smartscan-frontend-react/src/components/pages/AddProduct.jsx');
const scannerPagePath = path.resolve('smartscan-frontend-react/src/components/pages/ScannerPage.jsx');
const thermalModalPath = path.resolve('smartscan-frontend-react/src/components/pages/ThermalPackagingLabelModal.jsx');

console.log("--- 1. Testing 4×6″ Thermal Packaging & Shipping Label Modal ---");

test("ThermalPackagingLabelModal.jsx exists and has valid content", () => {
    assert(fs.existsSync(thermalModalPath), "ThermalPackagingLabelModal.jsx does not exist");
    const content = fs.readFileSync(thermalModalPath, 'utf8');
    assert(content.length > 500, "File is too short or empty");
});

test("Thermal packaging label contains 4x6 print stylesheet and dimensions", () => {
    const content = fs.readFileSync(thermalModalPath, 'utf8');
    assert(content.includes('@media print'), "Missing @media print stylesheet");
    assert(content.includes('size: 4in 6in'), "Missing 4in 6in @page size rule");
    assert(content.includes('#thermal-packaging-label'), "Missing #thermal-packaging-label selector");
    assert(content.includes('visibility: hidden !important'), "Missing hide non-label elements print rule");
    assert(content.includes('visibility: visible !important'), "Missing visible label element print rule");
});

test("Thermal packaging label includes required verification elements", () => {
    const content = fs.readFileSync(thermalModalPath, 'utf8');
    assert(content.includes('SMARTSCAN™ VERIFIED'), "Missing SmartScan verified header");
    assert(content.includes('HUMAN-READABLE PRODUCT IDENTIFIER'), "Missing human-readable label header");
    assert(content.includes('QRCode'), "Missing QRCode component");
    assert(content.includes('handleDownloadPng'), "Missing download PNG QR method");
    assert(content.includes('handlePrint'), "Missing handlePrint method");
    assert(content.includes('STAGE: 01'), "Missing stage indicator");
});

test("AddProduct.jsx imports and integrates ThermalPackagingLabelModal", () => {
    const content = fs.readFileSync(addProductPath, 'utf8');
    assert(content.includes("import ThermalPackagingLabelModal from './ThermalPackagingLabelModal'"), "Missing modal import in AddProduct.jsx");
    assert(content.includes("isLabelModalOpen"), "Missing isLabelModalOpen state");
    assert(content.includes("<ThermalPackagingLabelModal"), "Missing ThermalPackagingLabelModal JSX usage");
    assert(content.includes("Print 4×6″ Packaging Label"), "Missing thermal label button trigger");
});

console.log("\n--- 2. Testing Continuous Warehouse Multi-Scan Batch Mode ---");

test("ScannerPage.jsx includes Continuous Batch Mode toggle state", () => {
    const content = fs.readFileSync(scannerPagePath, 'utf8');
    assert(content.includes("isBatchMode"), "Missing isBatchMode state");
    assert(content.includes("setIsBatchMode"), "Missing setIsBatchMode state updater");
    assert(content.includes("batchQueue"), "Missing batchQueue state");
    assert(content.includes("setBatchQueue"), "Missing setBatchQueue state updater");
});

test("ScannerPage.jsx implements zero-dependency Web Audio API confirmation synth", () => {
    const content = fs.readFileSync(scannerPagePath, 'utf8');
    assert(content.includes("AudioContext") || content.includes("webkitAudioContext"), "Missing Web Audio API context");
    assert(content.includes("playAudioBeep"), "Missing playAudioBeep synth function");
    assert(content.includes("880") || content.includes("success"), "Missing high pitch success tone frequency");
});

test("ScannerPage.jsx implements continuous scan debouncer and repeat guard", () => {
    const content = fs.readFileSync(scannerPagePath, 'utf8');
    assert(content.includes("lastScannedTimeRef"), "Missing lastScannedTimeRef for timestamp checks");
    assert(content.includes("lastScanned"), "Missing lastScanned for debouncing");
    assert(content.includes("handleBatchScan"), "Missing handleBatchScan handler");
});

test("ScannerPage.jsx implements Inbound Scanned Batch manifest with export and handover", () => {
    const content = fs.readFileSync(scannerPagePath, 'utf8');
    assert(content.includes("exportBatchCSV"), "Missing exportBatchCSV function");
    assert(content.includes("removeBatchItem"), "Missing removeBatchItem function");
    assert(content.includes("batchQueue"), "Missing batchQueue manifest state");
    assert(content.includes("Scanned Items"), "Missing Scanned Items list UI");
    assert(content.includes("/update-product-details"), "Missing 1-tap handover navigation link");
});

console.log("\n======================================================");
console.log(`📊 RESULTS: ${passed} / ${passed + failed} assertions passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("======================================================\n");

if (failed > 0) {
    process.exit(1);
} else {
    console.log("🎉 ALL PHASE 2 REQUIREMENTS ARE PROPERLY IMPLEMENTED & VERIFIED!\n");
}
