import type { EnterpriseService } from "../services/enterprise";
import {
  Stage,
  type Account,
  type DemoState,
  type Facility,
  type Filter,
  type Operation,
  type Product,
  type ScanDraft,
  type Scenario,
  type SubmitAction,
  type Workspace,
} from "../domain/types";
import {
  belongsToView,
  capability,
  eligibleRecipient,
  parseCode,
} from "../domain/rules";
import { createFixtures } from "./fixtures";
import { profileLocation } from "../platform/location";

export interface Persistence {
  read(): DemoState | null;
  write(state: DemoState): void;
}
const clone = <T>(value: T): T => structuredClone(value);
export class DemoService implements EnterpriseService {
  constructor(
    private storage: Persistence,
    private now = () => Date.now(),
    private uuid: () => string = () => crypto.randomUUID(),
  ) {}
  private read(): DemoState {
    const stored = this.storage.read();
    if (stored) {
      if (
        stored.version !== 1 ||
        !Array.isArray(stored.products) ||
        !Array.isArray(stored.facilities)
      )
        throw new Error(
          "This saved demo is incompatible. Reset demo data from the welcome screen.",
        );
      return clone(stored);
    }
    const initial = createFixtures("normal", this.now());
    this.storage.write(initial);
    return initial;
  }
  private checkWorkspace(s: DemoState, w: Workspace): Facility {
    const a = s.accounts.find((a) => a.id === w.accountId);
    const f = s.facilities.find((f) => f.id === w.facilityId);
    if (
      !a ||
      !f ||
      a.role !== w.role ||
      f.accountId !== a.id ||
      f.role !== w.role
    )
      throw new Error(
        "Your workspace has changed. Select your facility again.",
      );
    return f;
  }
  private online(s: DemoState) {
    if (
      s.scenario === "offline" ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    )
      throw new Error(
        "You’re offline. Your draft is saved; reconnect before recording an action.",
      );
  }
  private admin(s: DemoState, w: Workspace) {
    const f = this.checkWorkspace(s, w);
    this.online(s);
    if (w.role !== "admin" || f.status !== "active")
      throw new Error("An active admin workspace is required.");
  }
  private settle(s: DemoState): boolean {
    if (
      s.scenario === "offline" ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    )
      return false;
    let changed = false;
    for (const op of [...s.operations].reverse()) {
      const f = s.facilities.find((f) => f.id === op.facilityId);
      for (const item of op.items) {
        if (item.status !== "submitted" || item.finishAt > this.now()) continue;
        changed = true;
        const p = s.products.find((p) => p.id === item.productId);
        const w = {
          accountId: op.accountId,
          facilityId: op.facilityId,
          role: f?.role || "supplier",
        } as Workspace;
        let reason =
          !p || !f ? "The item or facility is no longer available." : null;
        if (p && f) {
          // Registration's submitted state belongs to this operation, not a second registration.
          const candidate =
            op.action === "register"
              ? { ...p, registration: "pending_wallet" as const }
              : p;
          reason = capability(candidate, op.action, f, w);
          if (!reason && p.version !== item.expectedVersion)
            reason =
              "This record changed while the action was pending. Review its latest state.";
          if (!reason && op.action === "dispatch" && op.recipientId) {
            const r = s.facilities.find((r) => r.id === op.recipientId);
            if (!r || !eligibleRecipient(f, r))
              reason =
                "The destination is no longer eligible to receive this dispatch.";
          }
          if (!reason && p.failOnce) {
            reason =
              "Demo interruption. This item can be reviewed and tried again.";
            p.failOnce = false;
          }
          if (!reason) {
            if (op.action === "register") {
              p.registration = "confirmed";
              p.stage = Stage.Manufactured;
            }
            if (op.action === "receive") {
              p.stage = Stage.Delivered;
              p.custodianId = f.id;
              p.recipientId = null;
              p.senderRole = undefined;
            }
            if (op.action === "dispatch") {
              p.stage = Stage.Dispatched;
              p.recipientId = op.recipientId || null;
              p.senderRole = f.role;
            }
            if (op.action === "sell") p.stage = Stage.Sold;
            if (op.action === "recall") p.stage = Stage.Recalled;
            p.version++;
            p.history.push({
              id: `${op.id}-${p.id}`,
              action: op.action,
              actorId: f.id,
              recipientId: op.recipientId,
              at: new Date(item.finishAt).toISOString(),
              note: op.reason,
              location: op.location ? clone(op.location) : undefined,
            });
          } else if (op.action === "register") p.registration = "needs_retry";
        }
        item.status = reason ? "failed" : "confirmed";
        item.message = reason || undefined;
      }
    }
    return changed;
  }
  async snapshot() {
    const s = this.read();
    if (this.settle(s)) this.storage.write(s);
    return clone(s);
  }
  async products(w: Workspace, filter: Filter = "all", search = "") {
    const s = await this.snapshot();
    const f = this.checkWorkspace(s, w);
    const term = search.trim().toLowerCase();
    return s.products.filter(
      (p) =>
        belongsToView(p, filter, f, w) &&
        `${p.id} ${p.name} ${p.brand}`.toLowerCase().includes(term),
    );
  }
  async submit(input: SubmitAction) {
    // No await between read/check/write: the demo commits once in this JS context.
    const s = this.read();
    this.settle(s);
    const f = this.checkWorkspace(s, input.workspace);
    this.online(s);
    const previous = s.operations.find(
      (op) => op.requestKey === input.requestKey,
    );
    if (previous) {
      if (
        previous.accountId !== input.workspace.accountId ||
        previous.facilityId !== f.id
      )
        throw new Error("This request belongs to another workspace.");
      return clone(previous);
    }
    const ids = [...new Set(input.productIds)];
    if (!ids.length) throw new Error("Choose at least one eligible item.");
    if (
      input.action === "recall" &&
      (!input.reason?.trim() ||
        new TextEncoder().encode(input.reason.trim()).length > 500)
    )
      throw new Error("Add a recall reason of up to 500 bytes.");
    if (input.action === "dispatch") {
      if (input.recipientId === undefined)
        throw new Error(
          "Choose a destination or explicitly choose open dispatch.",
        );
      const r = s.facilities.find((r) => r.id === input.recipientId);
      if (input.recipientId !== null && (!r || !eligibleRecipient(f, r)))
        throw new Error("Choose an active, eligible destination.");
    }
    const products = ids.map((id) => {
      const p = s.products.find((p) => p.id === id);
      if (!p)
        throw new Error(
          "An item is no longer available. Review your scan session.",
        );
      const reason = capability(p, input.action, f, input.workspace);
      if (reason) throw new Error(`${p.name}: ${reason}`);
      if (
        s.operations.some((o) =>
          o.items.some((i) => i.productId === id && i.status === "submitted"),
        )
      )
        throw new Error(`${p.name} already has an action in progress.`);
      return p;
    });
    const op: Operation = {
      id: this.uuid(),
      requestKey: input.requestKey,
      action: input.action,
      facilityId: f.id,
      accountId: input.workspace.accountId,
      recipientId: input.recipientId,
      reason: input.reason?.trim(),
      createdAt: new Date(this.now()).toISOString(),
      location: clone(input.location || profileLocation(f.location, this.now())),
      items: products.map((p, i) => ({
        productId: p.id,
        expectedVersion: p.version,
        status: "submitted",
        finishAt: this.now() + 1500 + i * 650,
      })),
    };
    if (input.action === "register")
      products.forEach((p) => {
        p.registration = "submitted";
      });
    s.operations.unshift(op);
    // Remove submitted items only; exceptions remain in their original session.
    const draft = s.drafts.find(
      (d) => d.facilityId === f.id && d.task === input.action,
    );
    if (draft) draft.codes = draft.codes.filter((code) => !ids.includes(code));
    this.storage.write(s);
    return clone(op);
  }
  async createProduct(
    w: Workspace,
    input: Pick<
      Product,
      "id" | "name" | "brand" | "description" | "image" | "kind"
    >,
  ) {
    const s = this.read();
    const f = this.checkWorkspace(s, w);
    this.online(s);
    if (f.role !== "manufacturer" || f.status !== "active")
      throw new Error("An active manufacturer facility is required.");
    parseCode(input.id);
    if (
      !input.name.trim() ||
      input.name.trim().length > 50 ||
      !input.brand.trim() ||
      input.brand.trim().length > 50
    )
      throw new Error("Name and brand must each contain 1–50 characters.");
    if (new TextEncoder().encode(input.description).length > 1000)
      throw new Error("Description is too long. Use up to 1,000 bytes.");
    const existing = s.products.find((p) => p.id === input.id);
    if (existing) {
      if (
        existing.manufacturerId === f.id &&
        existing.name === input.name.trim() &&
        existing.brand === input.brand.trim()
      )
        return clone(existing);
      throw new Error(
        "This serial is already registered to a different product.",
      );
    }
    const p: Product = {
      ...input,
      name: input.name.trim(),
      brand: input.brand.trim(),
      stage: Stage.None,
      registration: "pending_wallet",
      manufacturerId: f.id,
      custodianId: f.id,
      recipientId: null,
      history: [],
      version: 1,
    };
    s.products.unshift(p);
    this.storage.write(s);
    return clone(p);
  }
  async saveDraft(draft: ScanDraft) {
    const s = this.read();
    s.drafts = [
      ...s.drafts.filter(
        (d) => d.facilityId !== draft.facilityId || d.task !== draft.task,
      ),
      { ...draft, codes: [...new Set(draft.codes)] },
    ];
    this.storage.write(s);
  }
  async setFacilityStatus(
    w: Workspace,
    id: string,
    status: Facility["status"],
  ) {
    const s = this.read();
    this.admin(s, w);
    const f = s.facilities.find((f) => f.id === id);
    if (!f || f.role === "admin")
      throw new Error("This facility cannot be changed here.");
    if (f.status === "revoked" && status === "active")
      throw new Error(
        "A revoked facility cannot be automatically restored. Provision a replacement.",
      );
    f.status = status;
    s.audit.unshift({
      id: this.uuid(),
      title: status === "active" ? "Facility approved" : "Facility revoked",
      detail: `${f.name} · Demo administration`,
      at: new Date(this.now()).toISOString(),
      facilityId: f.id,
    });
    this.storage.write(s);
  }
  async createAccount(w: Workspace, input: Omit<Account, "id">) {
    const s = this.read();
    this.admin(s, w);
    if (
      !input.name.trim() ||
      !/^[a-z0-9._-]{3,50}$/i.test(input.username) ||
      !["manufacturer", "supplier", "retailer"].includes(input.role)
    )
      throw new Error(
        "Enter a business name, a valid username, and a business role.",
      );
    if (
      s.accounts.some(
        (a) => a.username.toLowerCase() === input.username.toLowerCase(),
      )
    )
      throw new Error("That username is already in use.");
    const a: Account = { ...input, name: input.name.trim(), id: this.uuid() };
    s.accounts.push(a);
    this.storage.write(s);
    return clone(a);
  }
  async createFacility(
    w: Workspace,
    input: Pick<Facility, "accountId" | "name" | "code" | "location">,
  ) {
    const s = this.read();
    this.admin(s, w);
    const a = s.accounts.find((a) => a.id === input.accountId);
    if (
      !a ||
      a.role === "admin" ||
      !input.name.trim() ||
      !input.location.trim() ||
      !/^[a-z0-9-]{3,30}$/i.test(input.code)
    )
      throw new Error(
        "Enter a facility name, location, and a code using letters, numbers, or hyphens.",
      );
    if (
      s.facilities.some(
        (f) => f.code.toLowerCase() === input.code.toLowerCase(),
      )
    )
      throw new Error("That facility code already exists.");
    const id = this.uuid();
    const f: Facility = {
      ...input,
      code: input.code.toUpperCase(),
      id,
      role: a.role,
      status: "pending",
      wallet: "",
      name: input.name.trim(),
    };
    s.facilities.push(f);
    this.storage.write(s);
    return clone(f);
  }
  async reset(scenario: Scenario) {
    this.storage.write(createFixtures(scenario, this.now()));
  }
}

export const storageKey = "smartscan-enterprise-demo-v1";
export const demoService = new DemoService({
  read() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(
        "Saved demo data could not be read. Reset it from the welcome screen.",
      );
    }
  },
  write(state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      throw new Error(
        "The demo could not be saved on this device. Free some browser storage and try again.",
      );
    }
  },
});
