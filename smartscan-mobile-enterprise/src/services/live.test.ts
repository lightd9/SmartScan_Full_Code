import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { signIn, signOut, currentSession, api, restoreSession } from './session';
import { liveService, emptyLiveState } from './live';

const storage = new Map<string, string>();
const user = { username: 'maker', role: 'manufacturer' };
const product = { id: 'SS-00000000-0000-4000-8000-000000000001', version: 0 };
const state = { ...emptyLiveState, products: [product] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem:(key:string)=>storage.delete(key) });
  storage.clear(); signOut(false);
});
afterEach(() => vi.unstubAllGlobals());
it('keeps credentials off disk and signs out on expired authorization', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response({ token: 'test-token', user })).mockResolvedValueOnce(response({ error: 'Invalid or expired token' }, 401)).mockResolvedValueOnce(response({ error:'Please sign in again.' },401));
  vi.stubGlobal('fetch', fetcher);
  await signIn('maker', 'test-password');
  expect(storage.size).toBe(0);
  await expect(api('/api/enterprise/snapshot')).rejects.toThrow('expired');
  expect(currentSession()).toBeNull();
});
it('retries the exact persisted operation after a lost response', async () => {
  const payloads: string[] = [];
  const operation = { id: 'operation', requestKey: 'request', items: [] };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/auth')) return response({ token: 'test-token', user });
    if (url.endsWith('/snapshot')) return response(state);
    payloads.push(options.body as string);
    if (payloads.length === 1) throw new TypeError('Network error');
    return response(operation, 202);
  }));
  await signIn('maker', 'test-password');
  const input = { requestKey: 'request', workspace: { accountId: 'maker', facilityId: '1', role: 'manufacturer' as const },
    action: 'register' as const, productIds: [product.id], location: { source: 'profile' as const, address: 'Lagos', capturedAt: '2026-11-07T12:00:00Z' } };
  await expect(liveService.submit(input)).rejects.toThrow('Network error');
  await expect(liveService.submit({ ...input, location: { ...input.location, address: 'Changed' } })).resolves.toEqual(operation);
  expect(payloads[1]).toEqual(payloads[0]);
  expect(JSON.parse(payloads[0]).items[0].expectedVersion).toBe(0);
});
it('rejects a response from an account that has signed out', async () => {
  let finish!: (r: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ token: 'test-token', user }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })));
  await signIn('maker', 'test-password');
  const pending = api('/api/enterprise/snapshot');
  signOut(); finish(response(state));
  await expect(pending).rejects.toThrow('session changed');
});
it('renews one session for concurrent expired requests and keeps bearer tokens in memory', async()=>{
  let refreshes=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
    if(url.endsWith('/auth'))return response({token:'old',user});
    if(url.endsWith('/auth/refresh')){refreshes++;return response({token:'new',user});}
    const token=(options.headers as Record<string,string>).Authorization;
    return token==='Bearer old' ? response({error:'expired'},401) : response({ok:true});
  }));
  await signIn('maker','not-stored');
  const results=await Promise.all([api('/one'),api('/two')]);
  expect(results).toEqual([{ok:true},{ok:true}]);expect(refreshes).toBe(1);expect(storage.size).toBe(0);
});
it('retains the session on a connection error while resuming',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({token:'old',user})).mockRejectedValueOnce(new TypeError('offline')));
  await signIn('maker','not-stored');await expect(restoreSession()).rejects.toThrow('offline');expect(currentSession()?.user).toEqual(user);
});
it('does not resurrect a session if refresh finishes after signout',async()=>{
  let finish!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;})));
  const pending=restoreSession();await new Promise(resolve=>setTimeout(resolve,0));signOut(false);finish(response({token:'new',user}));expect(await pending).toBe(false);expect(currentSession()).toBeNull();
});
