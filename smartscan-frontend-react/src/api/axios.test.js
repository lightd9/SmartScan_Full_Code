import axiosBase, { AxiosError } from 'axios';
import api from './axios';
import { getAccessToken } from './authToken';

describe('authenticated API session lifecycle', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('clears the stored token and notifies auth state when an authenticated call expires', async () => {
        sessionStorage.setItem('smartscan_auth', JSON.stringify({ token: 'expired-token' }));
        const expired = vi.fn();
        window.addEventListener('smartscan:session-expired', expired);

        const adapter = async (config) => {
            expect(config.headers.Authorization).toBe('Bearer expired-token');
            throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
                status: 401, data: {}, headers: {}, config,
            });
        };

        await expect(api.get('/secure', { adapter })).rejects.toMatchObject({ response: { status: 401 } });
        expect(getAccessToken()).toBeNull();
        expect(expired).toHaveBeenCalledTimes(1);
        window.removeEventListener('smartscan:session-expired', expired);
    });

    it('does not expire the session for an unauthenticated login failure', async () => {
        sessionStorage.setItem('smartscan_auth', JSON.stringify({ token: 'still-valid-token' }));
        const adapter = async (config) => {
            throw new axiosBase.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
                status: 401, data: {}, headers: {}, config,
            });
        };
        await expect(api.post('/auth', {}, { adapter })).rejects.toMatchObject({ response: { status: 401 } });
        expect(getAccessToken()).toBe('still-valid-token');
    });
});
