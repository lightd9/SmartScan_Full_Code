import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storageKey } from "../dev/service";
import { enterpriseService } from "../services";
import type { Workspace } from "../domain/types";

const key = "smartscan-enterprise-workspace-v1";
function savedWorkspace(): Workspace | null {
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
  notify(text: string): void;
}>({ workspace: null, setWorkspace() {}, notice: "", notify() {} });
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, set] = useState(savedWorkspace);
  const [notice, notify] = useState("");
  const client = useQueryClient();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notify(""), 4200);
    return () => clearTimeout(timer);
  }, [notice]);
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
      w
        ? sessionStorage.setItem(key, JSON.stringify(w))
        : sessionStorage.removeItem(key);
    } catch {
      /* Memory session remains usable. */
    }
    client.clear();
  }
  return (
    <Context.Provider value={{ workspace, setWorkspace, notice, notify }}>
      {children}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
export const useSnapshot = () =>
  useQuery({
    queryKey: ["snapshot"],
    queryFn: () => enterpriseService.snapshot(),
    refetchInterval: (query) =>
      query.state.data?.operations.some((o) =>
        o.items.some((i) => i.status === "submitted"),
      )
        ? 700
        : false,
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
