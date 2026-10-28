import { getRegisteredProduct, parseHistoryTimestamp, parseProductQr } from './productQr';

const contract = '0x1111111111111111111111111111111111111111';
const serial = 'SS-00000000-0000-0000-0000-000000000001';

describe('parseProductQr', () => {
    it('accepts the configured contract and product identifier', () => {
        expect(parseProductQr(`${contract},${serial}`, contract)).toEqual({ contractAddress: contract, serialNumber: serial });
    });

    it('accepts a bare canonical serial number and attaches the expected contract', () => {
        expect(parseProductQr(serial, contract)).toEqual({ contractAddress: contract, serialNumber: serial });
    });

    it.each([null, '', 'not-a-wallet,serial', `${contract},`, `${contract},${serial},extra`])('rejects malformed payload %s', (payload) => {
        expect(() => parseProductQr(payload, contract)).toThrow('valid SmartScan product QR');
    });

    it('rejects a QR code from a different contract', () => {
        expect(() => parseProductQr(`0x2222222222222222222222222222222222222222,${serial}`, contract))
            .toThrow('unrecognized contract');
    });

    it('rejects identifiers that the V2 contract cannot register', () => {
        expect(() => parseProductQr(`${contract},legacy-id`, contract)).toThrow('invalid product identifier');
    });
});

describe('getRegisteredProduct', () => {
    it('does not read or return a product record for an unregistered identifier', async () => {
        const contractStub = { productExists: vi.fn().mockResolvedValue(false), getProduct: vi.fn() };
        await expect(getRegisteredProduct(contractStub, serial)).rejects.toThrow('not registered');
        expect(contractStub.getProduct).not.toHaveBeenCalled();
    });

    it('reads the full record only after the contract confirms registration', async () => {
        const record = ['serial', 'name'];
        const contractStub = { productExists: vi.fn().mockResolvedValue(true), getProduct: vi.fn().mockResolvedValue(record) };
        await expect(getRegisteredProduct(contractStub, serial)).resolves.toBe(record);
        expect(contractStub.getProduct).toHaveBeenCalledWith(serial);
    });
});

describe('parseHistoryTimestamp', () => {
    it('supports new block seconds and legacy ISO timestamps', () => {
        expect(parseHistoryTimestamp('1760918400')).toBe(1760918400);
        expect(parseHistoryTimestamp('2026-10-20T00:00:00Z')).toBe(1792454400);
    });

    it('returns null for an invalid timestamp', () => {
        expect(parseHistoryTimestamp('not-a-date')).toBeNull();
    });
});
