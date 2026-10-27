import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './AuthProvider';
import useAuth from '../hooks/useAuth';

function AuthProbe() {
    const { auth } = useAuth();
    return <output data-testid="auth-user">{auth.username || 'signed-out'}</output>;
}

describe('AuthProvider session expiry', () => {
    it('clears user state when an authenticated API request expires', async () => {
        sessionStorage.setItem('smartscan_auth', JSON.stringify({ username: 'brand-a', role: 'manufacturer', token: 'expired' }));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        await act(async () => root.render(<AuthProvider><AuthProbe /></AuthProvider>));
        expect(container.querySelector('[data-testid="auth-user"]').textContent).toBe('brand-a');

        await act(async () => window.dispatchEvent(new Event('smartscan:session-expired')));
        expect(container.querySelector('[data-testid="auth-user"]').textContent).toBe('signed-out');
        expect(sessionStorage.getItem('smartscan_auth')).toBeNull();

        await act(async () => root.unmount());
        container.remove();
    });
});
