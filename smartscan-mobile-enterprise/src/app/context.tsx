import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storageKey } from "../dev/service";
import { enterpriseService, isLive } from "../services";
import { currentSession, restoreSession } from '../services/session';
import { Loading } from '../design/ui';
import type { Workspace } from "../domain/types";

const key = "smartscan-enterprise-workspace-v1";
function savedWorkspace(): Workspace | null {
  if (isLive) return null;
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
const Context = createContext<{
  workspace: Workspace | null;
  setWorkspace(w: Workspace | null): void;
  notice: string;
  noticeId: number;
  notify(text: string): void;
}>({ workspace: null, setWorkspace() {}, notice: "", noticeId: 0, notify() {} });
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, set] = useState(savedWorkspace);
  const [restoring, setRestoring] = useState(isLive);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [message, setMessage] = useState({ text: "", id: 0 });
  const notice = message.text;
  function notify(text: string) {
    setMessage((current) => ({ text, id: current.id + 1 }));
  }
  const client = useQueryClient();
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    setRestoring(true); setRestoreError('');
    void (async () => {
      try {
        if (await restoreSession()) {
          const state = await enterpriseService.snapshot();
          const user = currentSession()?.user;
          const facilities = state.facilities.filter(f => f.accountId === user?.username && f.role === user?.role);
          let previous: Workspace | null = null;
          try { previous = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* no saved preference */ }
          const facility = facilities.find(f => f.id === previous?.facilityId && f.status === 'active') || facilities.find(f => f.status === 'active') || facilities[0];
          if (!cancelled && facility && user) set({ accountId: user.username, facilityId: facility.id, role: user.role });
        }
      } catch (error) { if (!cancelled) setRestoreError((error as Error).message); }
      finally { if (!cancelled) setRestoring(false); }
    })();
    return () => { cancelled = true; };
  }, [restoreAttempt]);
  useEffect(() => {
    const ended = () => { set(null); client.clear(); };
    window.addEventListener('smartscan-session-ended', ended);
    return () => window.removeEventListener('smartscan-session-ended', ended);
  }, [client]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setMessage((current) => ({ ...current, text: "" })), 2800);
    return () => clearTimeout(timer);
  }, [notice, message.id]);
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === storageKey) refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("storage", storageChanged);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [client]);
  function setWorkspace(w: Workspace | null) {
    set(w);
    try {
      if (isLive) {
        if (w) localStorage.setItem(key, JSON.stringify(w));
        else localStorage.removeItem(key);
      }
      w && !isLive
        ? sessionStorage.setItem(key, JSON.stringify(w))
        : sessionStorage.removeItem(key);
    } catch {
      /* Memory session remains usable. */
    }
    client.clear();
  }
  if (restoring) return <Loading />;
  if (restoreError) return <main className="welcome"><h1>Reconnect to your workspace</h1><p>{restoreError}</p><button className="primary" onClick={() => setRestoreAttempt(n => n + 1)}>Try again</button><button onClick={() => setRestoreError('')}>Go to sign in</button></main>;
  return (
    <Context.Provider value={{ workspace, setWorkspace, notice, noticeId: message.id, notify }}>
      {children}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
export const useSnapshot = () =>
  useQuery({
    queryKey: ["snapshot", isLive ? currentSession()?.user.username || 'signed-out' : 'demo'],
    queryFn: () => enterpriseService.snapshot(),
    refetchInterval: (query) =>
      query.state.data?.operations.some((o) =>
        o.items.some((i) => i.status === "submitted"),
      )
        ? isLive ? 5000 : 700
        : isLive && currentSession() ? 30000 : false,
    retry: false,
  });
export function useBusiness() {
  const ctx = useWorkspace();
  const snapshot = useSnapshot();
  const facility = snapshot.data?.facilities.find(
    (f) => f.id === ctx.workspace?.facilityId,
  );
  const account = snapshot.data?.accounts.find(
    (a) => a.id === ctx.workspace?.accountId,
  );
  return { ...ctx, ...snapshot, facility, account };
}
export function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}
