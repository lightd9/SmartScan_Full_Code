import { formatScanWarning, SCAN_RISK_CHECK_UNAVAILABLE, submitScanEvent } from './scanEvents';

describe('scan risk reporting', () => {
  it('returns server-verified scan flags', async () => {
    const api = { post: vi.fn().mockResolvedValue({ status: 201, data: { flags: ['unusual_frequency'] } }) };
    await expect(submitScanEvent(api, { serialNumber: 'SS-test' })).resolves.toEqual(['unusual_frequency']);
    expect(api.post).toHaveBeenCalledWith('/scan-events', { serialNumber: 'SS-test' });
  });

  it('warns instead of implying a clean result when anomaly checks fail or are malformed', async () => {
    await expect(submitScanEvent({ post: vi.fn().mockRejectedValue(new Error('API unavailable')) }, {}))
      .resolves.toEqual([SCAN_RISK_CHECK_UNAVAILABLE]);
    await expect(submitScanEvent({ post: vi.fn().mockResolvedValue({ status: 503, data: {} }) }, {}))
      .resolves.toEqual([SCAN_RISK_CHECK_UNAVAILABLE]);
    await expect(submitScanEvent({ post: vi.fn().mockResolvedValue({ status: 201, data: {} }) }, {}))
      .resolves.toEqual([SCAN_RISK_CHECK_UNAVAILABLE]);
  });

  it('explains anomaly flags and makes clear that scan location is unverified', () => {
    expect(formatScanWarning('suspicious_location')).toContain('unverified');
    expect(formatScanWarning('unusual_frequency')).toContain('copied or shared QR code');
    expect(formatScanWarning(SCAN_RISK_CHECK_UNAVAILABLE)).toContain('history is unknown');
  });
});
