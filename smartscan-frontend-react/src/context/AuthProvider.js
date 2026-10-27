import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { setAccessToken } from '../api/authToken';

const AuthContext = createContext({});

const STORAGE_KEY = "smartscan_auth";

function readStoredAuth() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const AuthProvider = ({ children }) => {
  const [auth, setAuthState] = useState(readStoredAuth);

  const setAuth = useCallback((value) => {
    const next = value || {};
    setAuthState(next);
    setAccessToken(next.token);
    try {
      if (next.token) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage may be unavailable (e.g. private mode) - fall back to memory only.
    }
  }, []);

  const logout = useCallback(() => setAuth({}), [setAuth]);

  useEffect(() => {
    const expireSession = () => logout();
    window.addEventListener('smartscan:session-expired', expireSession);
    return () => window.removeEventListener('smartscan:session-expired', expireSession);
  }, [logout]);

  const value = useMemo(() => ({ auth, setAuth, logout }), [auth, setAuth, logout]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export default AuthContext;
