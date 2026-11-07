import type {
  Account,
  DemoState,
  Facility,
  Filter,
  Operation,
  Product,
  ScanDraft,
  Scenario,
  SubmitAction,
  Workspace,
} from "../domain/types";

export interface EnterpriseService {
  snapshot(): Promise<DemoState>;
  products(
    workspace: Workspace,
    filter?: Filter,
    search?: string,
  ): Promise<Product[]>;
  submit(input: SubmitAction): Promise<Operation>;
  createProduct(
    workspace: Workspace,
    input: Pick<
      Product,
      "id" | "name" | "brand" | "description" | "image" | "kind"
    >,
  ): Promise<Product>;
  saveDraft(draft: ScanDraft): Promise<void>;
  setFacilityStatus(
    workspace: Workspace,
    facilityId: string,
    status: Facility["status"],
  ): Promise<void>;
  createAccount(
    workspace: Workspace,
    input: Omit<Account, "id">,
  ): Promise<Account>;
  createFacility(
    workspace: Workspace,
    input: Pick<Facility, "accountId" | "name" | "code" | "location">,
  ): Promise<Facility>;
  reset(scenario: Scenario): Promise<void>;
}
