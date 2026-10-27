const AUTH_STORAGE_KEY = 'smartscan_auth';
let memoryToken = null;

export function setAccessToken(token) {
    memoryToken = typeof token === 'string' && token ? token : null;
}

export function getAccessToken() {
    try {
        const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
        const storedToken = raw ? JSON.parse(raw)?.token : null;
        if (typeof storedToken === 'string' && storedToken) {
            memoryToken = storedToken;
            return storedToken;
        }
    } catch {
        // Browser storage can be disabled; use the current tab's in-memory session.
    }
    return memoryToken;
}

export function clearAccessToken() {
    setAccessToken(null);
    try {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        // The in-memory token is already cleared.
    }
}
