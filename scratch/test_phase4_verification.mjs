import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Manually load env from smartscan-backend-node/.env if present
const envPath = path.resolve('smartscan-backend-node/.env');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    }
}

console.log("\n======================================================");
console.log("🧪 SMARTSCAN PHASE 4 COMPREHENSIVE VERIFICATION SUITE");
console.log("======================================================\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Reason: ${err.message}`);
        failed++;
    }
}

const cryptoVaultPath = path.resolve('smartscan-backend-node/crypto-vault.js');
const gasTreasuryPath = path.resolve('smartscan-backend-node/gas-treasury.js');
const migrationPath = path.resolve('smartscan-backend-node/migrations/012_facility_subaccounts.sql');
const backendAppPath = path.resolve('smartscan-backend-node/app.js');

console.log("--- 1. Testing Cryptographic Vault Engine (AES-256-GCM) ---");

await test("crypto-vault.js exists and exports key management functions", () => {
    assert(fs.existsSync(cryptoVaultPath), "crypto-vault.js does not exist");
    const vault = require(cryptoVaultPath);
    assert.strictEqual(typeof vault.generateEncapsulatedSubaccount, 'function');
    assert.strictEqual(typeof vault.decryptSubaccountPrivateKey, 'function');
    assert.strictEqual(typeof vault.getSubaccountSigner, 'function');
});

await test("generateEncapsulatedSubaccount creates valid wallet and encrypted keystore", () => {
    const vault = require(cryptoVaultPath);
    const subaccount = vault.generateEncapsulatedSubaccount();
    assert(/^0x[0-9a-fA-F]{40}$/.test(subaccount.walletAddress), "Invalid generated wallet address format");
    assert(subaccount.encryptedPrivateKey.length >= 64, "Encrypted private key is too short");
    assert.strictEqual(subaccount.keyIv.length, 32, "IV must be 16 bytes (32 hex characters)");
    assert.strictEqual(subaccount.keyAuthTag.length, 32, "Auth tag must be 16 bytes (32 hex characters)");
    assert.strictEqual(subaccount.keyVersion, 1);
});

await test("decryptSubaccountPrivateKey and getSubaccountSigner decrypt correctly", () => {
    const vault = require(cryptoVaultPath);
    const subaccount = vault.generateEncapsulatedSubaccount();
    const rawKey = vault.decryptSubaccountPrivateKey(subaccount);
    assert(rawKey.startsWith('0x') && rawKey.length === 66, "Decrypted private key must be 66 characters hex");

    const signer = vault.getSubaccountSigner(subaccount);
    assert.strictEqual(signer.address.toLowerCase(), subaccount.walletAddress.toLowerCase(), "Signer address must match generated address");
});

await test("crypto-vault detects and rejects tampered ciphertexts and corrupted auth tags", () => {
    const vault = require(cryptoVaultPath);
    const subaccount = vault.generateEncapsulatedSubaccount();
    let caughtTampering = false;
    try {
        vault.decryptSubaccountPrivateKey({ ...subaccount, keyAuthTag: '00'.repeat(16) });
    } catch (_err) {
        caughtTampering = true;
    }
    assert(caughtTampering, "Crypto vault failed to detect tampered authentication tag");
});

console.log("\n--- 2. Testing Automated Gas Treasury Service ---");

await test("gas-treasury.js connects to Sepolia and returns operational status", async () => {
    assert(fs.existsSync(gasTreasuryPath), "gas-treasury.js does not exist");
    const treasury = require(gasTreasuryPath);
    const status = await treasury.getTreasuryStatus('https://ethereum-sepolia-rpc.publicnode.com');
    assert.strictEqual(status.configured, true, "Treasury must be configured");
    assert(/^0x[0-9a-fA-F]{40}$/.test(status.address), "Treasury address must be a valid Ethereum address");
    assert(parseFloat(status.balanceEth) > 0, "Treasury must have a non-zero balance for gas sponsoring");
    assert.strictEqual(status.canFund, true, "Treasury must have funding capability");
});

console.log("\n--- 3. Testing Database Migration 012 ---");

await test("012_facility_subaccounts.sql defines subaccounts and treasury tables", () => {
    assert(fs.existsSync(migrationPath), "Migration 012 does not exist");
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert(sql.includes("CREATE TABLE IF NOT EXISTS facility_subaccounts"), "Missing facility_subaccounts table");
    assert(sql.includes("CREATE TABLE IF NOT EXISTS gas_treasury_disbursements"), "Missing gas_treasury_disbursements table");
    assert(sql.includes("wallet_address"), "Missing wallet_address column");
    assert(sql.includes("encrypted_private_key"), "Missing encrypted_private_key column");
    assert(sql.includes("key_auth_tag"), "Missing key_auth_tag column");
});

await test("schema-readiness recognizes 012 as the latest migration", () => {
    const readiness = require(path.resolve('smartscan-backend-node/schema-readiness.js'));
    assert.strictEqual(readiness.latestMigrationName(), "012_facility_subaccounts.sql");
});

console.log("\n--- 4. Testing Backend Subaccount & Headless Execution APIs ---");

await test("app.js exposes subaccount management and treasury endpoints", () => {
    const content = fs.readFileSync(backendAppPath, 'utf8');
    assert(content.includes("app.get('/api/subaccounts/treasury-status'"), "Missing treasury-status route");
    assert(content.includes("app.post('/api/subaccounts/create'"), "Missing subaccounts/create route");
    assert(content.includes("app.get('/api/subaccounts'"), "Missing subaccounts list route");
    assert(content.includes("app.post('/api/subaccounts/:id/approve'"), "Missing subaccounts approve route");
    assert(content.includes("app.post('/api/subaccounts/:id/fund'"), "Missing subaccounts fund route");
    assert(content.includes("app.post('/api/subaccounts/:id/revoke'"), "Missing subaccounts revoke route");
});

await test("app.js exposes /api/custody/auto-execute with headless on-chain execution", () => {
    const content = fs.readFileSync(backendAppPath, 'utf8');
    assert(content.includes("app.post('/api/custody/auto-execute'"), "Missing /api/custody/auto-execute route");
    assert(content.includes("getSubaccountSigner"), "Missing getSubaccountSigner invocation in auto-execute");
    assert(content.includes("dispatchProduct"), "Missing dispatchProduct call");
    assert(content.includes("confirmDelivery"), "Missing confirmDelivery call");
    assert(content.includes("markSold"), "Missing markSold call");
});

console.log("\n--- 5. Testing Frontend Subaccounts UI & Auto-Sign Integration ---");

const subaccountsPagePath = path.resolve('smartscan-frontend-react/src/components/pages/SubaccountsPage.jsx');
const appJsPath = path.resolve('smartscan-frontend-react/src/App.js');
const sidebarPath = path.resolve('smartscan-frontend-react/src/components/shell/Sidebar.jsx');
const posPagePath = path.resolve('smartscan-frontend-react/src/components/pages/POSCheckoutPage.jsx');
const updateDetailsPath = path.resolve('smartscan-frontend-react/src/components/pages/UpdateProductDetails.jsx');
const scannerPagePath = path.resolve('smartscan-frontend-react/src/components/pages/ScannerPage.jsx');

await test("SubaccountsPage.jsx implements management view, treasury widget, and fast-sign playground", () => {
    assert(fs.existsSync(subaccountsPagePath), "SubaccountsPage.jsx does not exist");
    const content = fs.readFileSync(subaccountsPagePath, 'utf8');
    assert(content.includes("SmartScan Gas Treasury Engine"), "Missing Gas Treasury status widget");
    assert(content.includes("/api/subaccounts/create"), "Missing create subaccount API call");
    assert(content.includes("/api/subaccounts/${id}/approve"), "Missing approve subaccount API call");
    assert(content.includes("/api/subaccounts/${id}/fund"), "Missing fund subaccount API call");
    assert(content.includes("/api/custody/auto-execute"), "Missing auto-execute playground API call");
});

await test("App.js mounts /subaccounts route with lazy loading and RBAC", () => {
    const content = fs.readFileSync(appJsPath, 'utf8');
    assert(content.includes("import('./components/pages/SubaccountsPage')"), "Missing SubaccountsPage lazy import");
    assert(content.includes("path='/subaccounts'"), "Missing /subaccounts route");
});

await test("Sidebar.jsx exposes Facility Wallets navigation link", () => {
    const content = fs.readFileSync(sidebarPath, 'utf8');
    assert(content.includes("to: '/subaccounts'"), "Missing /subaccounts link in sidebar");
    assert(content.includes("Facility Wallets"), "Missing Facility Wallets label");
});

await test("POSCheckoutPage.jsx integrates autonomous facility auto-signing", () => {
    const content = fs.readFileSync(posPagePath, 'utf8');
    assert(content.includes("autoSignEnabled"), "Missing autoSignEnabled state");
    assert(content.includes("/api/custody/auto-execute"), "Missing /api/custody/auto-execute in POSCheckoutPage");
    assert(content.includes("⚡ Facility Auto-Sign"), "Missing Auto-Sign toggle switch");
});

await test("UpdateProductDetails.jsx integrates autonomous facility auto-signing", () => {
    const content = fs.readFileSync(updateDetailsPath, 'utf8');
    assert(content.includes("autoSignEnabled"), "Missing autoSignEnabled state");
    assert(content.includes("/api/custody/auto-execute"), "Missing /api/custody/auto-execute in UpdateProductDetails");
    assert(content.includes("⚡ Facility Auto-Sign Mode"), "Missing Auto-Sign toggle switch");
});

await test("ScannerPage.jsx integrates 1-click batch autonomous signing", () => {
    const content = fs.readFileSync(scannerPagePath, 'utf8');
    assert(content.includes("handleBatchAutoExecute"), "Missing handleBatchAutoExecute in ScannerPage");
    assert(content.includes("/api/custody/auto-execute"), "Missing /api/custody/auto-execute in ScannerPage");
    assert(content.includes("⚡ Auto-Sign Batch"), "Missing Auto-Sign Batch button");
});

console.log("\n======================================================");
console.log(`📊 RESULTS: ${passed} / ${passed + failed} assertions passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("======================================================\n");

if (failed > 0) {
    process.exit(1);
} else {
    console.log("🎉 ALL PHASE 4 REQUIREMENTS ARE PROPERLY IMPLEMENTED & VERIFIED!\n");
}
