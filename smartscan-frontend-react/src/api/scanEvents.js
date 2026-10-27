export const SCAN_RISK_CHECK_UNAVAILABLE = 'scan_risk_check_unavailable';

const SCAN_WARNING_MESSAGES = {
  invalid_identifier: 'The scanned identifier or contract does not match a registered SmartScan product.',
  suspicious_location: 'This code was recently scanned from locations more than 100 km apart. Browser-reported locations are unverified; confirm the product with its manufacturer.',
  unusual_frequency: 'This code has had unusually frequent scans in the last 10 minutes. A copied or shared QR code is possible.',
  conflicting_product_state: 'The blockchain history contains conflicting supply-chain events. Do not rely on this product until it is investigated.',
  [SCAN_RISK_CHECK_UNAVAILABLE]: 'Scan anomaly checks could not be completed. The blockchain record was checked, but suspicious-scan history is unknown.',
};

export async function submitScanEvent(api, payload) {
  try {
    const response = await api.post('/scan-events', payload);
    if (response?.status !== 201 || !Array.isArray(response.data?.flags)) {
      return [SCAN_RISK_CHECK_UNAVAILABLE];
    }
    return response.data.flags.filter((flag) => typeof flag === 'string');
  } catch (_error) {
    return [SCAN_RISK_CHECK_UNAVAILABLE];
  }
}

export function formatScanWarning(warning) {
  return SCAN_WARNING_MESSAGES[warning] || String(warning).replace(/_/g, ' ');
}
