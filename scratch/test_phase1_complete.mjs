import { parseProductQr } from '../smartscan-frontend-react/src/api/productQr.js';
import { determineCustodyAction } from '../smartscan-frontend-react/src/utils/stageActions.js';
import { autoDetectLocation } from '../smartscan-frontend-react/src/utils/locationResolver.js';

const CONTRACT = '0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96';
const SERIAL = 'SS-1a0a75a9-9d5e-4c23-8ae3-4df58fcb0667';
const MOCK_MANUFACTURER = '0x1111111111111111111111111111111111111111';
const MOCK_SUPPLIER = '0x2222222222222222222222222222222222222222';
const MOCK_RETAILER = '0x3333333333333333333333333333333333333333';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 SMARTSCAN PHASE 1 COMPREHENSIVE VERIFICATION SUITE');
  console.log('======================================================\n');

  // --- SECTION 1: QR CODE PARSING & UNIVERSAL URLS ---
  console.log('--- 1. Testing Universal QR Code & Identifier Parsing ---');
  
  // 1.1 Universal Vercel URL
  const r1 = parseProductQr(`https://smart-scan-ten.vercel.app/verify/${SERIAL}`, CONTRACT);
  assert(r1.serialNumber === SERIAL && r1.contractAddress === CONTRACT, 'Parses production HTTPS verify URL');

  // 1.2 Localhost Dev URL
  const r2 = parseProductQr(`http://localhost:3000/verify/${SERIAL}`, CONTRACT);
  assert(r2.serialNumber === SERIAL && r2.contractAddress === CONTRACT, 'Parses local dev HTTP verify URL');

  // 1.3 Query parameter URL
  const r3 = parseProductQr(`https://smart-scan-ten.vercel.app/product?serialNumber=${SERIAL}`, CONTRACT);
  assert(r3.serialNumber === SERIAL && r3.contractAddress === CONTRACT, 'Parses query parameter product URL');

  // 1.4 Legacy Comma-separated format
  const r4 = parseProductQr(`${CONTRACT},${SERIAL}`, CONTRACT);
  assert(r4.serialNumber === SERIAL && r4.contractAddress === CONTRACT, 'Parses legacy comma-separated contract,serial');

  // 1.5 Bare canonical serial identifier
  const r5 = parseProductQr(SERIAL, CONTRACT);
  assert(r5.serialNumber === SERIAL && r5.contractAddress === CONTRACT, 'Parses bare canonical SS-UUID identifier');

  // 1.6 Rejects unrecognized contract address
  let caughtContractMismatch = false;
  try {
    parseProductQr(`0x0000000000000000000000000000000000000001,${SERIAL}`, CONTRACT);
  } catch (err) {
    caughtContractMismatch = err.message.includes('unrecognized contract');
  }
  assert(caughtContractMismatch, 'Rejects QR code pointing to foreign contract address');

  // 1.7 Rejects non-SmartScan payload
  let caughtMalformed = false;
  try {
    parseProductQr('https://phishing-site.com/fake-product-12345', CONTRACT);
  } catch (err) {
    caughtMalformed = err.message.includes('not a valid SmartScan');
  }
  assert(caughtMalformed, 'Rejects generic non-SmartScan URLs');


  // --- SECTION 2: SUPPLY CHAIN ACTION ENGINE & CHAINED HANDOVER ---
  console.log('\n--- 2. Testing Supply Chain Action Engine & Handover Logic ---');

  // 2.1 Manufacturer Minted -> Dispatches to Supply Chain
  const mfgAction = determineCustodyAction({
    stage: 1, // Manufactured
    custodian: MOCK_MANUFACTURER,
    role: 'manufacturer',
    walletAddress: MOCK_MANUFACTURER,
  });
  assert(
    mfgAction.actionKey === 'dispatch_from_factory' &&
    mfgAction.canExecute === true &&
    mfgAction.buttonLabel === 'Sign & Dispatch to Supply Chain',
    'Manufacturer at Stage 1 can dispatch directly to supply chain'
  );

  // 2.2 Consignment In Transit -> Supplier Receives
  const supplierReceiptAction = determineCustodyAction({
    stage: 2, // Dispatched
    custodian: MOCK_MANUFACTURER,
    pendingRecipient: '0x0000000000000000000000000000000000000000', // Open Dispatch
    role: 'supplier',
    walletAddress: MOCK_SUPPLIER,
    history: [{ action: 1, actorRole: 2 }], // Dispatched by Manufacturer
  });
  assert(
    supplierReceiptAction.actionKey === 'confirm_delivery_supplier' &&
    supplierReceiptAction.canExecute === true &&
    supplierReceiptAction.buttonLabel === 'Sign & Confirm Warehouse Delivery Receipt',
    'Supplier can claim Open Dispatch delivery from Manufacturer'
  );

  // 2.3 Supplier In Custody (Stage 3) -> Next Action: Dispatch to Retailer
  const supplierForwardAction = determineCustodyAction({
    stage: 3, // Delivered
    custodian: MOCK_SUPPLIER,
    role: 'supplier',
    walletAddress: MOCK_SUPPLIER,
  });
  assert(
    supplierForwardAction.actionKey === 'dispatch_to_retailer' &&
    supplierForwardAction.canExecute === true &&
    supplierForwardAction.buttonLabel === 'Sign & Dispatch to Retail Partner',
    'Supplier in custody can immediately dispatch forward to Retail Partner'
  );

  // 2.4 Retailer Receives Inbound Consignment from Supplier
  const retailerReceiptAction = determineCustodyAction({
    stage: 2, // Dispatched
    custodian: MOCK_SUPPLIER,
    pendingRecipient: '0x0000000000000000000000000000000000000000',
    role: 'retailer',
    walletAddress: MOCK_RETAILER,
    history: [{ action: 1, actorRole: 3 }], // Dispatched by Supplier
  });
  assert(
    retailerReceiptAction.actionKey === 'confirm_delivery_retailer' &&
    retailerReceiptAction.canExecute === true &&
    retailerReceiptAction.buttonLabel === 'Sign & Confirm Store Delivery Receipt',
    'Retailer can claim delivery receipt from Supplier'
  );

  // 2.5 Retailer In Custody (Stage 3) -> Next Action: Mark as Sold
  const retailerSaleAction = determineCustodyAction({
    stage: 3, // Delivered
    custodian: MOCK_RETAILER,
    role: 'retailer',
    walletAddress: MOCK_RETAILER,
  });
  assert(
    retailerSaleAction.actionKey === 'mark_sold' &&
    retailerSaleAction.canExecute === true &&
    retailerSaleAction.buttonLabel === 'Sign & Mark Product as Sold on Blockchain',
    'Retailer in custody can finalize consumer sale (Mark Sold)'
  );

  // 2.6 Product Finalized (Sold) -> Sealed State
  const soldAction = determineCustodyAction({
    stage: 4, // Sold
    isSold: true,
    custodian: MOCK_RETAILER,
    role: 'retailer',
    walletAddress: MOCK_RETAILER,
  });
  assert(
    soldAction.actionKey === 'sold' &&
    soldAction.canExecute === false &&
    soldAction.buttonLabel.includes('Already Sold'),
    'Sold product state is permanently locked and non-executable'
  );


  // --- SECTION 3: AUTOMATED LOCATION RESOLVER ---
  console.log('\n--- 3. Testing Background Location Resolver ---');
  let updateCallbackFired = false;
  let detectedLocation = null;
  try {
    const locRes = await autoDetectLocation({
      onUpdate: (u) => {
        updateCallbackFired = true;
        detectedLocation = u;
      },
    });
    assert(
      Boolean(locRes && locRes.location && locRes.latitude && locRes.longitude),
      `Auto-detect location resolved: ${locRes.location} (Lat: ${locRes.latitude}, Long: ${locRes.longitude})`
    );
    assert(updateCallbackFired, 'Progressive update callback fired immediately on resolution');
  } catch (locErr) {
    assert(false, `Location detection threw error: ${locErr.message}`);
  }


  // --- SECTION 4: LIVE PRODUCTION DEPLOYMENT HEALTH ---
  console.log('\n--- 4. Testing Live Vercel Production Deployment ---');
  try {
    const verifyRes = await fetch(`https://smart-scan-ten.vercel.app/verify/${SERIAL}`);
    assert(verifyRes.status === 200, `Live /verify/:serial route responds HTTP ${verifyRes.status}`);

    const appRes = await fetch('https://smart-scan-ten.vercel.app/');
    assert(appRes.status === 200, `Live root application route responds HTTP ${appRes.status}`);

    const scannerRes = await fetch('https://smart-scan-ten.vercel.app/verify');
    assert(scannerRes.status === 200, `Live /verify redirect route responds HTTP ${scannerRes.status}`);
  } catch (netErr) {
    assert(false, `Network verification failed: ${netErr.message}`);
  }

  // --- FINAL SCORE ---
  console.log('\n======================================================');
  console.log(`📊 RESULTS: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 1 REQUIREMENTS ARE PROPERLY IMPLEMENTED & VERIFIED!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Some tests failed. Please review the output above.\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
