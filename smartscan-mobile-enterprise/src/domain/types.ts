import type { TransactionLocation } from "../platform/location";
export type Role = "admin" | "manufacturer" | "supplier" | "retailer";
export type BusinessRole = Exclude<Role, "admin">;
export type FacilityStatus = "active" | "pending" | "revoked" | "suspended";
export type Registration =
  | "pending_wallet"
  | "submitted"
  | "confirmed"
  | "needs_retry";
// Stage and history-action numeric values differ in IdenteefiV2.
export enum Stage {
  None,
  Manufactured,
  Dispatched,
  Delivered,
  Sold,
  Recalled,
}
export type Task = "receive" | "dispatch" | "sell";
export type Action = Task | "register" | "recall";
export type Scenario = "normal" | "empty" | "partial" | "offline";
export type Filter =
  | "all"
  | "incoming"
  | "held"
  | "outgoing"
  | "pending"
  | "sold"
  | "recalled";
export interface Account {
  id: string;
  name: string;
  username: string;
  role: Role;
}
export interface Facility {
  id: string;
  accountId: string;
  name: string;
  code: string;
  role: Role;
  status: FacilityStatus;
  location: string;
  wallet: string;
  balanceEth?: string | null;
  chainRole?: string | null;
}
export interface Workspace {
  accountId: string;
  facilityId: string;
  role: Role;
}
export interface Movement {
  actorName?: string;
  location?: TransactionLocation;
  id: string;
  action: Action;
  actorId: string;
  recipientId?: string | null;
  at: string;
  note?: string;
}
export interface Product {
  chainAvailable?: boolean;
  chainId?: string;
  contractAddress?: string;
  id: string;
  name: string;
  brand: string;
  kind: "carton" | "bottle";
  image?: string;
  description: string;
  registration: Registration;
  stage: Stage;
  manufacturerId: string;
  custodianId: string;
  recipientId: string | null;
  senderRole?: Role;
  version: number;
  history: Movement[];
  failOnce?: boolean;
}
export interface OperationItem {
  phase?: 'queued' | 'submitted' | 'confirmed' | 'failed';
  txHash?: string | null;
  blockNumber?: string | number | null;
  productId: string;
  expectedVersion: number;
  status: "submitted" | "confirmed" | "failed";
  message?: string;
  finishAt: number;
}
export interface Operation {
  location?: TransactionLocation;
  id: string;
  requestKey: string;
  action: Action;
  facilityId: string;
  accountId: string;
  recipientId?: string | null;
  reason?: string;
  createdAt: string;
  items: OperationItem[];
}
export interface ScanDraft {
  facilityId: string;
  task: Task;
  codes: string[];
}
export interface AuditEvent {
  id: string;
  title: string;
  detail: string;
  at: string;
  facilityId?: string;
}
export interface ScanAlert {
  id: string;
  productId: string;
  title: string;
  detail: string;
  at: string;
}
export interface DemoState {
  warnings?: string[];
  network?: { chainId: string; contractAddress: string; name: string };
  version: 1;
  scenario: Scenario;
  accounts: Account[];
  facilities: Facility[];
  products: Product[];
  operations: Operation[];
  drafts: ScanDraft[];
  audit: AuditEvent[];
  alerts: ScanAlert[];
}
export interface SubmitAction {
  location?: TransactionLocation;
  requestKey: string;
  workspace: Workspace;
  action: Action;
  productIds: string[];
  recipientId?: string | null;
  reason?: string;
}
export const roleNames: Record<Role, string> = {
  admin: "Admin",
  manufacturer: "Manufacturer",
  supplier: "Supplier",
  retailer: "Retailer",
};
export const stageNames: Record<Stage, string> = {
  0: "Not registered",
  1: "At factory",
  2: "In transit",
  3: "Received",
  4: "Sold",
  5: "Recalled",
};
export const actionNames: Record<Action, string> = {
  register: "Registration",
  receive: "Receipt",
  dispatch: "Dispatch",
  sell: "Sale",
  recall: "Recall",
};
