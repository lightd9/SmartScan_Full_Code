const PASSPORT_HISTORY_KEY = 'smartscan_consumer_history';
const SAVED_REPORTS_KEY = 'smartscan_consumer_reports';

export function getScanHistory() {
  try {
    const raw = localStorage.getItem(PASSPORT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

export function saveScanToHistory(product) {
  if (!product || !product.serialNumber) return;
  try {
    const existing = getScanHistory();
    const filtered = existing.filter((item) => item.serialNumber !== product.serialNumber);
    const updated = [
      {
        ...product,
        scannedAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 30); // Keep last 30 scans
    localStorage.setItem(PASSPORT_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save scan to history:', err);
  }
}

export function clearScanHistory() {
  localStorage.removeItem(PASSPORT_HISTORY_KEY);
}

export function getSavedReports() {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

export function saveReport(report) {
  try {
    const existing = getSavedReports();
    const updated = [
      {
        ...report,
        id: `REP-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
      ...existing,
    ];
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save report:', err);
  }
}
