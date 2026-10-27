import { getAccessToken, setAccessToken } from './authToken';

describe('API access-token fallback', () => {
    beforeEach(() => {
        sessionStorage.clear();
        setAccessToken(null);
    });

    it('uses the in-memory session if sessionStorage is unavailable', () => {
        setAccessToken('memory-token');
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage disabled'); });
        expect(getAccessToken()).toBe('memory-token');
        getItem.mockRestore();
    });

    it('prefers the persisted token and clears the memory token on logout', () => {
        setAccessToken('stale-token');
        sessionStorage.setItem('smartscan_auth', JSON.stringify({ token: 'current-token' }));
        expect(getAccessToken()).toBe('current-token');
        setAccessToken(null);
        sessionStorage.removeItem('smartscan_auth');
        expect(getAccessToken()).toBeNull();
    });
});
