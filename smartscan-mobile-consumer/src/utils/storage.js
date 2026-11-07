const PASSPORT_HISTORY_KEY = 'smartscan_consumer_history';
const SAVED_REPORTS_KEY = 'smartscan_consumer_reports';

export function getScanHistory() {
  try {
    const raw = localStorage.getItem(PASSPORT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.serialNumber === 'string') : [];
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
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string') : [];
  } catch (_e) {
    return [];
  }
}

export function saveReport(report) {
    const existing = getSavedReports();
    const saved = { ...report, id: `REP-${crypto.randomUUID()}`, timestamp: new Date().toISOString() };
    const updated = [
      saved,
      ...existing,
    ];
    localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(updated));
    return saved;
}

export function getHapticsEnabled() {
  try { return localStorage.getItem('smartscan_haptics') !== 'false'; } catch { return true; }
}

export function setHapticsEnabled(enabled) {
  localStorage.setItem('smartscan_haptics', String(enabled));
}
