import { apiBase } from './config';
import type { Role } from '../domain/types';

type Session = { token: string; user: { username: string; role: Role } };
// Access tokens stay in memory. Closing the native app requires sign-in again;
// passwords and wallet private keys are never saved on the device.
let session: Session | null = null;
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const currentSession = () => session;
export function signOut() {
  session = null;
  window.dispatchEvent(new Event('smartscan-session-ended'));
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const token = session?.token;
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options, signal: controller.signal,
      headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token && session?.token === token) signOut();
      throw new ApiError(data.error || `The server could not complete this request (${response.status}).`, response.status);
    }
    // Never apply a previous account's response after sign-out/account switch.
    if (token && session?.token !== token) throw new Error('Your session changed. Please try again.');
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('The connection timed out. Check Activity before trying the action again.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function signIn(username: string, password: string) {
  session = null;
  const response = await api<Session>('/auth', { method: 'POST', body: JSON.stringify({ username: username.trim(), password }) });
  if (!response.token || !['admin','manufacturer','supplier','retailer'].includes(response.user?.role))
    throw new Error('This account does not have Enterprise access.');
  session = response;
  return response.user;
}
