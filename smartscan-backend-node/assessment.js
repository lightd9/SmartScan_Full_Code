const { randomUUID } = require('crypto');

const POLICY_VERSION = 'v2-evidence-1';
const FLAG_MESSAGES = {
  invalid_identifier: 'This identifier was not found on the configured SmartScan contract. This alone does not establish counterfeiting.',
  conflicting_product_state: 'The recorded custody history contains inconsistent events. Review the supply-chain record before relying on it.',
  suspicious_location: 'This code was scanned more than 100 km apart within an hour. Submitted locations are unverified and may reflect travel or a shared code.',
  unusual_frequency: 'This code has at least 10 scans in 10 minutes. Repeated legitimate checks or a copied or shared QR code are possible.',
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
  historyChecked = false, assessedAt = new Date().toISOString(), assessmentId = randomUUID() }) {
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
  add('location', 'scan_location', 'unknown',
    hasLocation ? 'Submitted scan location is unverified. Purchase location and seller distance have not been assessed.' : 'Location was not provided. This is not suspicious evidence.', 'user_reported');
  add('production', 'production_release_unknown', 'unknown', 'An individual-unit production release feed is not connected.', 'not_connected');
  add('packing', 'packing_unknown', 'unknown', 'Exact unit-to-carton membership is not available for this record.', 'not_connected');
  add('seller', 'seller_not_compared', 'unknown', 'The seller you purchased from has not been compared with the recorded custodian.', 'not_provided');
  let status = !live ? (found ? 'REGISTERED' : 'UNAVAILABLE') : !found ? 'NOT_FOUND' : sold ? 'SOLD' : 'REGISTERED';
  let title = !live ? (found ? 'Product found in the registry.' : 'Verification is unavailable.') : !found ? 'Identifier not found.' : sold ? 'Sale recorded for this product.' : 'Registered identity found.';
  let description = !live ? 'Current blockchain status is unavailable. Try again before relying on this record.' : !found ? 'Check the code and manufacturer coverage. A missing record alone does not prove counterfeiting.' : sold ? 'A sale is recorded. Checking a product after purchase is normal.' : 'The code matches a registered record. This does not prove the physical contents of the product.';
  let tone = found && live ? 'authentic' : 'neutral';
  if (concerns.some(flag => flag !== 'invalid_identifier') && found) {
    status = 'CONCERN'; title = 'This record needs a closer look.'; tone = 'warning';
    description = 'One or more checks raised a concern. Review the findings and confirm with the manufacturer.';
  }
  if (recalled) { status = 'RECALLED'; title = 'This product has been recalled.'; tone = 'warning'; description = 'Do not purchase or use this product. Contact the manufacturer.'; }
  const expected = ['identity', 'custody', 'safety', 'anomaly', 'production', 'packing', 'seller', 'location'];
  const assessed = expected.filter(domain => findings.some(f => f.domain === domain && ['supported', 'concern'].includes(f.state)));
  const receipt = [...(product.history || [])].reverse().find(event => [0, 2].includes(event.action) && event.actorWallet?.toLowerCase() === product.custodian?.toLowerCase());
  return {
    assessmentId, policyVersion: POLICY_VERSION, assessedAt,
    subject: { serialNumber: product.serialNumber, scope: 'registered_item', unitIdentityConfirmed: false },
    source: { kind: product.source, chainId: product.chainId || null, contractAddress: product.contractAddress || null, verifiedAt: live ? assessedAt : null },
    summary: { status, title, description, tone, label: ({ REGISTERED: live ? 'Identity found' : 'Registry only', SOLD: 'Sale recorded', RECALLED: 'Recalled', CONCERN: 'Review findings', NOT_FOUND: 'Not found', UNAVAILABLE: 'Unavailable' })[status] },
    findings, coverage: { assessed: assessed.length, expected: expected.length, missing: expected.filter(domain => !assessed.includes(domain)) },
    safety: { recalled, expiry: 'unknown' }, score: null,
    custodian: receipt ? { wallet: product.custodian, name: receipt.actor, role: receipt.actorRole, recordedLocation: receipt.location, recordedAt: receipt.timestamp } : null,
  };
}

module.exports = { POLICY_VERSION, FLAG_MESSAGES, chainProduct, assessProduct };
