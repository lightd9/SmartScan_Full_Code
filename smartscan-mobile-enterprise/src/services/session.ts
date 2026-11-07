import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { apiBase } from './config';
import type { Role } from '../domain/types';

type Session = { token: string; user: { username: string; role: Role }; refreshToken?: string };
const key = 'smartscan-session-v1';
const native = () => Capacitor.isNativePlatform();
let session: Session | null = null;
let generation = 0;
let renewing: Promise<boolean> | null = null;
let ending: Promise<unknown> = Promise.resolve();
let storageQueue: Promise<unknown> = Promise.resolve();
const stored = <T>(action: () => Promise<T>): Promise<T> => {
  const next = storageQueue.then(action, action); storageQueue = next.catch(() => {}); return next;
};
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const currentSession = () => session;
async function refreshCredential() {
  if (!native()) return {};
  try { return { refreshToken: (await stored(() => SecureStoragePlugin.get({ key }))).value }; }
  catch { return null; }
}
async function request(path: string, options: RequestInit = {}, token?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options, credentials: 'include', signal: controller.signal,
      headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        'X-SmartScan-Session': '1', 'X-SmartScan-Protocol': '3',
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || `The server could not complete this request (${response.status}).`, response.status);
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The connection timed out. Check Activity before trying the action again.');
    throw error;
  } finally { clearTimeout(timer); }
}
export function signOut(revoke = true) {
  generation++; session = null; renewing = null;
  if(revoke && !native()) try {localStorage.setItem('smartscan-session-disabled','true');} catch { /* native credentials are cleared independently */ }
  const credential = refreshCredential();
  if (native()) void stored(() => SecureStoragePlugin.remove({ key })).catch(() => {});
  if (revoke) ending = credential.then(body => body && request('/auth/logout', { method: 'POST', body: JSON.stringify(body) })).catch(() => {});
  window.dispatchEvent(new Event('smartscan-session-ended'));
}
export async function restoreSession(): Promise<boolean> {
  if (renewing) return renewing;
  if(!native()) try {if(localStorage.getItem('smartscan-session-disabled')==='true')return false;} catch { /* browser storage may be restricted */ }
  const epoch = generation;
  const promise = (async () => {
    const body = await refreshCredential();
    if (!body || epoch !== generation) return false;
    try {
      const result: Session = await request('/auth/refresh', { method: 'POST', body: JSON.stringify(body) });
      if (epoch !== generation) return false;
      if (!result.token || !['admin', 'manufacturer', 'supplier', 'retailer'].includes(result.user?.role)) throw new Error('Invalid session response.');
      session = result; return true;
    } catch (error) {
      if (epoch !== generation) return false;
      if (error instanceof ApiError && error.status === 401) { signOut(false); return false; }
      // Connectivity loss is not a revoked session.
      throw error;
    }
  })();
  renewing = promise;
  try { return await promise; } finally { if (renewing === promise) renewing = null; }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const epoch = generation;
  const token = session?.token;
  let data;
  try { data = await request(path, options, token); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !token || epoch !== generation) throw error;
    if (session?.token === token && !await restoreSession()) throw error;
    if (epoch !== generation || !session) throw new Error('Your session changed. Please try again.');
    data = await request(path, options, session.token);
  }
  if (epoch !== generation) throw new Error('Your session changed. Please try again.');
  return data as T;
}
export async function signIn(username: string, password: string) {
  const epoch = ++generation; session = null;
  await ending;
  const result: Session = await request('/auth', { method: 'POST', body: JSON.stringify({ username: username.trim(), password, sessionMode: native() ? 'native' : 'browser' }) });
  if (epoch !== generation) throw new Error('Your session changed. Please try again.');
  if (!result.token || !['admin','manufacturer','supplier','retailer'].includes(result.user?.role)) throw new Error('This account does not have Enterprise access.');
  if (native() && result.refreshToken) await stored(() => SecureStoragePlugin.set({ key, value: result.refreshToken! }));
  if (epoch !== generation) throw new Error('Your session changed. Please try again.');
  session = { token: result.token, user: result.user };
  if(!native()) try {localStorage.removeItem('smartscan-session-disabled');} catch { /* cookie remains available */ }
  return result.user;
}
