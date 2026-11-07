const { randomUUID } = require('crypto');

const { purchaseFindings } = require('./purchase-evidence');
const POLICY_VERSION = 'evidence-2';
const WEIGHTS = { identity:25, custody:25, issuer:10, seller:20, location:10, anomaly:10 };
const FLAG_MESSAGES = {
  invalid_identifier: 'This identifier was not found on the configured SmartScan contract. This alone does not establish counterfeiting.',
  conflicting_product_state: 'The recorded custody history contains inconsistent events. Review the supply-chain record before relying on it.',
  suspicious_location: 'This code was scanned more than 100 km apart within an hour. Submitted locations are unverified and may reflect travel or a shared code.',
  unusual_frequency: 'This code has at least 10 checks from multiple network sources in 10 minutes. A shared or copied code is possible; this provisional signal is not proof of counterfeiting.',
};

function chainProduct(raw, serialNumber, contractAddress, chainId) {
  const exists = raw?.[0] === serialNumber;
  if (!exists) return { serialNumber, exists: false, source: 'chain', contractAddress, chainId: String(chainId) };
  return {
    serialNumber: raw[0], name: raw[1], brand: raw[2], description: raw[3], imageHash: raw[4],
    history: Array.from(raw[5] || [], event => ({
      id: Number(event[0]), actor: event[1], actorWallet: event[2], location: event[3],
      timestamp: String(event[4]), action: Number(event[5]), recipientWallet: event[6], actorRole: Number(event[7]),
    })),
    stage: Number(raw[6]), custodian: raw[7], pendingRecipient: raw[8],
    isSold: Boolean(raw[9]), recalled: Boolean(raw[10]), exists: true,
    source: 'chain', contractAddress, chainId: String(chainId),
  };
}

// The policy reports evidence, not a probability of physical authenticity.
function assessProduct({ product, flags = [], monitoring = 'unavailable', hasLocation = false,
  historyChecked = false, purchase = null, evidence = {}, assessedAt = new Date().toISOString(), assessmentId = randomUUID() }) {
  const live = product.source === 'chain';
  const found = product.exists === true;
  const currentStateKnown = live && found && Number.isInteger(product.stage) && product.stage >= 1 && product.stage <= 5;
  const recalled = found && (product.recalled === true || Number(product.stage) === 5);
  const sold = found && (product.isSold === true || Number(product.stage) === 4);
  const concerns = flags.filter(flag => FLAG_MESSAGES[flag]);
  const findings = [];
  const add = (domain, code, state, explanation, source = product.source) => findings.push({ domain, code, state, explanation, source, checkedAt: assessedAt });
  add('identity', live ? (found ? 'registered_identity' : 'identity_not_found') : (found ? 'registry_only' : 'identity_unavailable'),
    live ? (found ? 'supported' : 'unknown') : 'unavailable', live
      ? found ? 'This identifier is registered on the configured blockchain. A copied identifier can also match.' : FLAG_MESSAGES.invalid_identifier
      : found ? 'A database record was found. Current blockchain status could not be checked.' : 'Current product records could not be checked.');
  add('custody', 'custody_history', live && found && historyChecked ? (flags.includes('conflicting_product_state') ? 'concern' : 'supported') : 'unknown',
    live && found && historyChecked ? flags.includes('conflicting_product_state') ? FLAG_MESSAGES.conflicting_product_state : 'The recorded custody sequence passed the available consistency checks.' : 'Confirmed custody consistency could not be assessed.');
  add('safety', recalled ? 'recalled' : 'recall_status', recalled ? 'concern' : currentStateKnown ? 'supported' : 'unknown',
    recalled ? 'A recall is recorded. Do not purchase or use this product; contact the manufacturer.' : currentStateKnown ? 'No recall is recorded in the current contract state. Other safety checks are not available.' : 'Current recall status could not be checked.');
  add('anomaly', 'scan_monitoring', monitoring === 'complete' ? concerns.some(flag => ['suspicious_location', 'unusual_frequency'].includes(flag)) ? 'concern' : 'supported' : 'unavailable',
    monitoring === 'complete' ? 'Recent scan activity was checked using provisional thresholds.' : 'Scan anomaly checks could not be completed; suspicious-scan history is unknown.', 'scan_monitor');
  for (const flag of concerns.filter(flag => !['invalid_identifier', 'conflicting_product_state'].includes(flag))) add('anomaly', flag, 'concern', FLAG_MESSAGES[flag], 'scan_monitor');
  add('issuer', 'manufacturer_registration', evidence.issuer?.active ? 'supported' : 'unknown',
    evidence.issuer?.active ? 'The manufacturer wallet is linked to an active registered SmartScan business.' : 'Current manufacturer account approval could not be confirmed.', 'business_registry');
  for (const finding of purchaseFindings(purchase, evidence, Date.parse(assessedAt))) findings.push({ ...finding,checkedAt:assessedAt });
  add('production', 'production_release_deferred', 'unknown', 'Manufacturer production-system integration is not included in this version.', 'not_connected');
  add('packing', 'packing_deferred', 'unknown', 'Unit-to-pack relationships are not included in this version.', 'not_connected');
  const checks = Object.entries(WEIGHTS).map(([domain,weight]) => {
    const group = findings.filter(f=>f.domain===domain);
    const state=group.some(f=>f.state==='concern') ? 'concern' : group.some(f=>f.state==='supported') ? 'supported' : 'unknown';
    return { domain,weight,state,earned:state==='supported' ? weight : 0 };
  });
  const value=checks.reduce((sum,c)=>sum+c.earned,0);
  const hasConcern=findings.some(f=>f.state==='concern');
  const requiredPassed=['identity','custody','seller'].every(d=>checks.some(c=>c.domain===d && c.state==='supported'));
  let status = !live ? 'UNAVAILABLE' : !found ? 'NOT_FOUND' : hasConcern ? 'CONCERN' : value>=70 && requiredPassed ? 'VERIFIED' : 'INCOMPLETE';
  let title = status==='VERIFIED' ? 'Authenticity checks passed.' : status==='CONCERN' ? 'Potential authenticity risk.' : status==='NOT_FOUND' ? 'Unable to authenticate this code.' : value>=40 && live && found ? 'More verification needed.' : 'Unable to authenticate yet.';
  let description = status==='VERIFIED' ? 'The registered identity, custody and retailer checks agree. These checks support authenticity; a copied code can still match.'
    : status==='CONCERN' ? 'One or more checks raised a concern. View the findings and confirm with the seller or manufacturer.'
    : status==='NOT_FOUND' ? 'This code was not found in SmartScan. Check the code and manufacturer coverage.'
    : !live ? 'Current blockchain status could not be checked. Reconnect and try again.'
    : evidence.retailer ? 'Confirm where you bought the product to complete its retailer check.' : 'Identity checks alone are insufficient. Confirmed retailer custody is needed.';
  let tone=status==='VERIFIED' ? 'authentic' : hasConcern ? 'warning' : 'neutral';
  if (recalled) { status='RECALLED';title='This product has been recalled.';description='Do not purchase or use this product. Contact the manufacturer.';tone='warning'; }
  const expected=[...Object.keys(WEIGHTS),'safety'];
  const assessed=expected.filter(domain=>findings.some(f=>f.domain===domain && ['supported','concern'].includes(f.state)));
  const receipt = [...(product.history || [])].reverse().find(event => [0, 2].includes(event.action) && event.actorWallet?.toLowerCase() === product.custodian?.toLowerCase());
  return {
    assessmentId, policyVersion: POLICY_VERSION, assessedAt,
    subject: { serialNumber: product.serialNumber, scope: 'registered_item', unitIdentityConfirmed: false },
    source: { kind: product.source, chainId: product.chainId || null, contractAddress: product.contractAddress || null, protocol:product.protocol || 'v2', verifiedAt: live ? assessedAt : null },
    summary: { status, title, description, tone, label: ({ VERIFIED:'Checks passed', INCOMPLETE:'More checks needed', RECALLED:'Recalled', CONCERN:'Potential risk', NOT_FOUND:'Not found', UNAVAILABLE:'Unavailable' })[status] },
    findings, coverage: { assessed: assessed.length, expected: expected.length, missing: expected.filter(domain => !assessed.includes(domain)) },
    safety: { recalled, expiry: 'unknown' }, lifecycle: { sold, stage:product.stage, label:sold ? 'Sale recorded' : 'Not marked sold' },
    score: live && found ? { value,max:100,label:'Evidence score',policy:'pilot-weights-1',checks,passed:checks.filter(c=>c.state==='supported').length,total:checks.length,interpretation:'Supporting evidence, not the probability of physical authenticity. Unknown checks earn no points and are not failures.' } : null,
    retailer:evidence.retailer || null,
    custodian: receipt ? { wallet: product.custodian, name: receipt.actor, role: receipt.actorRole, recordedLocation: receipt.location, recordedAt: receipt.timestamp } : null,
  };
}

module.exports = { POLICY_VERSION, FLAG_MESSAGES, chainProduct, assessProduct };
