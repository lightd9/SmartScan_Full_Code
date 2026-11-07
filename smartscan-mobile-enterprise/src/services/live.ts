import type { EnterpriseService } from './enterprise';
import type { DemoState, Operation, Product, ScanDraft, SubmitAction } from '../domain/types';
import { api, currentSession, ApiError } from './session';
import { apiBase } from './config';
import { belongsToView } from '../domain/rules';

function accountKey(suffix: string) {
  const user = currentSession()?.user;
  if (!user) throw new Error('Sign in to your SmartScan account.');
  return `smartscan-live:${user.username}:${suffix}`;
}
function readLocal<T>(suffix: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(accountKey(suffix)) || 'null') ?? fallback; }
  catch { return fallback; }
}
const saveLocal = (suffix: string, value: unknown) => localStorage.setItem(accountKey(suffix), JSON.stringify(value));
export const emptyLiveState: DemoState = { version: 1, scenario: 'normal', accounts: [], facilities: [], products: [], operations: [], drafts: [], audit: [], alerts: [] };
async function snapshot(): Promise<DemoState> {
  if (!currentSession()) return emptyLiveState;
  const state = await api<DemoState>('/api/enterprise/snapshot');
  return { ...state, drafts: readLocal<ScanDraft[]>('drafts', []), products: state.products.map(p => ({ ...p,
    image: p.image ? `${apiBase}/file/product/${encodeURIComponent(p.image)}` : undefined })) };
}
export const liveService: EnterpriseService = {
  snapshot,
  async products(w, filter = 'all', search = '') {
    const state = await snapshot();
    const facility = state.facilities.find(f => f.id === w.facilityId);
    if (!facility) return [];
    return state.products.filter(p => belongsToView(p, filter, facility, w)
      && `${p.id} ${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase()));
  },
  async submit(input: SubmitAction) {
    if (input.workspace.accountId !== currentSession()?.user.username) throw new Error('Sign in to the correct business account.');
    const saved = readLocal<Record<string, unknown>>('pending-requests', {});
    let payload = saved[input.requestKey];
    if (payload) {
      const original = payload as { action: string; facilityId: string; items: { productId: string }[]; recipientId: string | null; reason: string };
      if (original.action !== input.action || original.facilityId !== input.workspace.facilityId
          || original.recipientId !== (input.recipientId || null) || original.reason !== (input.reason || '')
          || JSON.stringify(original.items.map(i => i.productId)) !== JSON.stringify(input.productIds))
        throw new Error('An earlier request from this screen may still be processing. Check Activity before changing the action.');
    }
    if (!payload) {
      const state = await snapshot();
      const previous = state.operations.find(o => o.requestKey === input.requestKey);
      if (previous) return previous;
      payload = { requestKey: input.requestKey, facilityId: input.workspace.facilityId, action: input.action,
        items: input.productIds.map(productId => {
          const p = state.products.find(p => p.id === productId);
          if (!p) throw new Error('Product is not available in the current inventory.');
          return { productId, expectedVersion: p.version };
        }), recipientId: input.recipientId || null, reason: input.reason || '', location: input.location };
      // Save the exact payload (including the first location measurement) before
      // sending. A network retry reuses it, even if the screen refreshed.
      saved[input.requestKey] = payload;
      saveLocal('pending-requests', saved);
    }
    let operation: Operation;
    try { operation = await api<Operation>('/api/enterprise/operations', { method: 'POST', body: JSON.stringify(payload) }); }
    catch (error) {
      if (error instanceof ApiError && [400,403,404,409].includes(error.status)) {
        delete saved[input.requestKey]; saveLocal('pending-requests', saved);
      }
      throw error;
    }
    delete saved[input.requestKey]; saveLocal('pending-requests', saved);
    if (['receive','dispatch','sell'].includes(input.action)) {
      const drafts = readLocal<ScanDraft[]>('drafts', []).map(d => d.facilityId === input.workspace.facilityId && d.task === input.action
        ? { ...d, codes: d.codes.filter(code => !input.productIds.includes(code)) } : d);
      saveLocal('drafts', drafts);
    }
    return operation;
  },
  async createProduct(w, input) {
    let image = '';
    const uploads = readLocal<Record<string, { digest: string; name: string }>>('uploads', {});
    if (input.image?.startsWith('data:')) {
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.image))))
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      const old = uploads[input.id];
      if (old?.digest === digest) image = old.name;
      else {
        const blob = await (await fetch(input.image)).blob();
        const form = new FormData(); form.append('image', blob, `${input.id}.jpg`);
        const uploaded = await api<{ fileName: string }>('/upload/product', { method: 'POST', body: form });
        image = uploaded.fileName; uploads[input.id] = { digest, name: image }; saveLocal('uploads', uploads);
      }
    }
    await api('/api/enterprise/products', { method: 'POST', body: JSON.stringify({ ...input, image, facilityId: w.facilityId }) });
    const state = await snapshot();
    const product = state.products.find(p => p.id === input.id);
    if (!product) throw new Error('Product was saved. Refresh inventory to check its registration.');
    return product as Product;
  },
  async saveDraft(draft) {
    const drafts = readLocal<ScanDraft[]>('drafts', []).filter(d => d.facilityId !== draft.facilityId || d.task !== draft.task);
    saveLocal('drafts', [...drafts, draft]);
  },
  async setFacilityStatus(_w, id, status) {
    if (!['active','revoked'].includes(status)) throw new Error('Choose approval or revocation.');
    await api(`/api/subaccounts/${encodeURIComponent(id)}/${status === 'active' ? 'approve' : 'revoke'}`, { method: 'POST', body: '{}' });
  },
  async createAccount(_w, input) {
    await api('/addaccount', { method: 'POST', body: JSON.stringify(input) });
    return { id: input.username, name: input.name, username: input.username, role: input.role };
  },
  async createFacility(_w, input) {
    const state = await snapshot();
    const account = state.accounts.find(a => a.id === input.accountId);
    if (!account) throw new Error('Business account unavailable.');
    const result = await api<{ subaccount: { id: number } }>('/api/subaccounts/create', { method: 'POST', body: JSON.stringify({
      parentUsername: account.username, subaccountName: input.name, facilityCode: input.code, role: account.role, location: input.location,
    }) });
    const updated = await snapshot();
    return updated.facilities.find(f => f.id === String(result.subaccount.id))!;
  },
  async reset() { throw new Error('Demo resets are unavailable for live accounts.'); },
};
