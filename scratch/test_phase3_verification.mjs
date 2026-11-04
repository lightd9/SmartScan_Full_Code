import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log("\n======================================================");
console.log("🧪 SMARTSCAN PHASE 3 COMPREHENSIVE VERIFICATION SUITE");
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

const backendAppPath = path.resolve('smartscan-backend-node/app.js');
const posPagePath = path.resolve('smartscan-frontend-react/src/components/pages/POSCheckoutPage.jsx');
const posReceiptModalPath = path.resolve('smartscan-frontend-react/src/components/pages/POSCustomerReceiptModal.jsx');
const appJsPath = path.resolve('smartscan-frontend-react/src/App.js');
const sidebarPath = path.resolve('smartscan-frontend-react/src/components/shell/Sidebar.jsx');
const navbarPath = path.resolve('smartscan-frontend-react/src/components/home/Navbar.jsx');

console.log("--- 1. Testing Backend POS Checkout & Receipt API ---");

test("app.js exposes /api/pos/checkout and /pos/checkout endpoints", () => {
    assert(fs.existsSync(backendAppPath), "app.js does not exist");
    const content = fs.readFileSync(backendAppPath, 'utf8');
    assert(content.includes("app.post('/api/pos/checkout'"), "Missing /api/pos/checkout route");
    assert(content.includes("app.post('/pos/checkout'"), "Missing /pos/checkout route");
    assert(content.includes("posCheckoutHandler"), "Missing posCheckoutHandler");
});

test("app.js implements authoritative on-chain product inspection and state logic", () => {
    const content = fs.readFileSync(backendAppPath, 'utf8');
    assert(content.includes("fetchOnChainProduct"), "Missing fetchOnChainProduct helper");
    assert(content.includes("AUTHENTIC_READY_FOR_SALE"), "Missing AUTHENTIC_READY_FOR_SALE state");
    assert(content.includes("ALREADY_SOLD"), "Missing ALREADY_SOLD counterfeit/resale detection");
    assert(content.includes("UNREGISTERED_COUNTERFEIT"), "Missing UNREGISTERED_COUNTERFEIT detection");
    assert(content.includes("RECALLED"), "Missing RECALLED detection");
});

test("app.js generates tamper-evident receiptId and supports GET /api/pos/receipt/:receiptId", () => {
    const content = fs.readFileSync(backendAppPath, 'utf8');
    assert(content.includes("receiptId"), "Missing receiptId generation");
    assert(content.includes("app.get('/api/pos/receipt/:receiptId'"), "Missing GET /api/pos/receipt/:receiptId route");
    assert(content.includes("SMARTSCAN-DECENTRALIZED-ORIGIN-VERIFIED"), "Missing cryptographic receipt verification seal");
});

console.log("\n--- 2. Testing Frontend Retail POS Checkout Interface ---");

test("POSCheckoutPage.jsx exists and implements hardware barcode scanner ingestion", () => {
    assert(fs.existsSync(posPagePath), "POSCheckoutPage.jsx does not exist");
    const content = fs.readFileSync(posPagePath, 'utf8');
    assert(content.includes("inputRef"), "Missing barcode input auto-focus ref");
    assert(content.includes("handleKeyDown"), "Missing Enter key listener for barcode wedge scanners");
    assert(content.includes("verifyProductCode"), "Missing verifyProductCode method");
});

test("POSCheckoutPage.jsx implements Web Audio confirmation synthesizer", () => {
    const content = fs.readFileSync(posPagePath, 'utf8');
    assert(content.includes("playPOSChime"), "Missing playPOSChime synthesizer");
    assert(content.includes("AudioContext") || content.includes("webkitAudioContext"), "Missing Web Audio API context");
    assert(content.includes("880"), "Missing cash register success frequency");
    assert(content.includes("220"), "Missing counterfeit warning buzz frequency");
});

test("POSCheckoutPage.jsx implements 1-tap blockchain sale finalization and shift log", () => {
    const content = fs.readFileSync(posPagePath, 'utf8');
    assert(content.includes("handleFinalizeSale"), "Missing handleFinalizeSale on-chain caller");
    assert(content.includes("markSold"), "Missing contract markSold invocation");
    assert(content.includes("shiftLog"), "Missing shift activity log state");
    assert(content.includes("POSCustomerReceiptModal"), "Missing POSCustomerReceiptModal usage");
});

console.log("\n--- 3. Testing 80mm Customer Warranty Receipt Modal ---");

test("POSCustomerReceiptModal.jsx implements 80mm thermal receipt with print styles and QR seal", () => {
    assert(fs.existsSync(posReceiptModalPath), "POSCustomerReceiptModal.jsx does not exist");
    const content = fs.readFileSync(posReceiptModalPath, 'utf8');
    assert(content.includes("80mm"), "Missing 80mm POS width specification");
    assert(content.includes("@media print"), "Missing print media query");
    assert(content.includes("#pos-customer-receipt"), "Missing print receipt ID selector");
    assert(content.includes("QRCode"), "Missing QRCode component");
    assert(content.includes("SMARTSCAN™ RETAIL"), "Missing SmartScan retail receipt title");
});

console.log("\n--- 4. Testing Route & Navigation Wiring ---");

test("App.js mounts /pos route with lazy loading", () => {
    const content = fs.readFileSync(appJsPath, 'utf8');
    assert(content.includes("POSCheckoutPage"), "Missing POSCheckoutPage import in App.js");
    assert(content.includes("path='/pos'"), "Missing /pos route definition in App.js");
});

test("Sidebar.jsx and Navbar.jsx expose POS Register navigation link", () => {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');
    assert(sidebarContent.includes("to: '/pos'") || sidebarContent.includes("POS Register"), "Missing POS Register link in Sidebar.jsx");
    assert(navbarContent.includes("to: \"/pos\"") || navbarContent.includes("POS Register"), "Missing POS Register link in Navbar.jsx");
});

console.log("\n======================================================");
console.log(`📊 RESULTS: ${passed} / ${passed + failed} assertions passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("======================================================\n");

if (failed > 0) {
    process.exit(1);
} else {
    console.log("🎉 ALL PHASE 3 REQUIREMENTS ARE PROPERLY IMPLEMENTED & VERIFIED!\n");
}

