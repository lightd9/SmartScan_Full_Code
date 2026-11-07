import { describe, expect, it } from "vitest";
import { DemoService } from "./service";
import { createFixtures, demoSerial } from "./fixtures";
import {
  Stage,
  type DemoState,
  type Scenario,
  type Workspace,
} from "../domain/types";

const supplier: Workspace = {
  accountId: "supply",
  facilityId: "warehouse",
  role: "supplier",
};
const admin: Workspace = {
  accountId: "admin",
  facilityId: "admin-hq",
  role: "admin",
};
function setup(scenario: Scenario = "normal") {
  let saved: DemoState = createFixtures(scenario, 100000000);
  let now = 100000000;
  let id = 0;
  const persistence = {
    read: () => structuredClone(saved),
    write: (s: DemoState) => {
      saved = structuredClone(s);
    },
  };
  const make = () =>
    new DemoService(
      persistence,
      () => now,
      () => `operation-${++id}`,
    );
  return {
    service: make(),
    reopen: make,
    advance: () => {
      now += 10000;
    },
  };
}
describe("durable local demo operation lifecycle", () => {
  it("preserves the submitted location across retries, confirmation, and reload", async () => {
    const t = setup();
    const location = {
      address: "Receiving depot", source: "device" as const,
      latitude: 6.6, longitude: 3.3, accuracyMeters: 14,
      capturedAt: new Date(100000000).toISOString(),
    };
    const original = structuredClone(location);
    const input = { workspace: supplier, requestKey: "located-receipt", action: "receive" as const, productIds: [demoSerial(1), demoSerial(2)], location };
    const op = await t.service.submit(input);
    location.address = "Later address";
    const retry = await t.reopen().submit(input);
    expect(retry.id).toBe(op.id);
    expect(retry.location).toEqual(original);
    t.advance();
    const state = await t.reopen().snapshot();
    for (const id of input.productIds) {
      expect(state.products.find(p => p.id === id)!.history.at(-1)!.location).toEqual(original);
    }
  });
  it("snapshots the profile fallback without fabricating locations for older history", async () => {
    const t = setup();
    const op = await t.service.submit({ workspace: supplier, requestKey: "profile", action: "receive", productIds: [demoSerial(1)] });
    expect(op.location?.source).toBe("profile");
    t.advance();
    const p = (await t.reopen().snapshot()).products.find(p => p.id === demoSerial(1))!;
    expect(p.history.at(-1)!.location).toEqual(op.location);
    expect(p.history[0].location).toBeUndefined();
  });
  it("sells one received item while preserving other custody and saved session items", async () => {
    const t = setup();
    const retailer: Workspace = {
      accountId: "retail",
      facilityId: "store",
      role: "retailer",
    };
    await t.service.submit({
      workspace: retailer,
      requestKey: "receipt",
      action: "receive",
      productIds: [demoSerial(5)],
    });
    t.advance();
    await t.service.snapshot();
    await t.service.saveDraft({
      facilityId: "store",
      task: "sell",
      codes: [demoSerial(5), demoSerial(6)],
    });
    await t.service.submit({
      workspace: retailer,
      requestKey: "one-sale",
      action: "sell",
      productIds: [demoSerial(5)],
    });
    t.advance();
    const state = await t.reopen().snapshot();
    expect(state.operations[0].items.map((i) => i.productId)).toEqual([
      demoSerial(5),
    ]);
    expect(state.operations[0].items[0].status).toBe("confirmed");
    expect(state.products.find((p) => p.id === demoSerial(5))!.stage).toBe(
      Stage.Sold,
    );
    const remaining = state.products.find((p) => p.id === demoSerial(6))!;
    expect(remaining.stage).toBe(Stage.Delivered);
    expect(remaining.custodianId).toBe("store");
    expect(remaining.history.some((h) => h.action === "sell")).toBe(false);
    expect(
      state.drafts.find((d) => d.facilityId === "store" && d.task === "sell")!
        .codes,
    ).toEqual([demoSerial(6)]);
  });
  it("records an explicit open dispatch and allows an eligible retailer to receive it", async () => {
    const t = setup();
    await t.service.submit({
      workspace: supplier,
      requestKey: "open",
      action: "dispatch",
      productIds: [demoSerial(3)],
      recipientId: null,
    });
    t.advance();
    const dispatched = await t.service.snapshot();
    expect(
      dispatched.products.find((p) => p.id === demoSerial(3))!.recipientId,
    ).toBeNull();
    await t.service.submit({
      workspace: { accountId: "retail", facilityId: "store", role: "retailer" },
      requestKey: "claim",
      action: "receive",
      productIds: [demoSerial(3)],
    });
    t.advance();
    const received = (await t.reopen().snapshot()).products.find(
      (p) => p.id === demoSerial(3),
    )!;
    expect(received.stage).toBe(Stage.Delivered);
    expect(received.custodianId).toBe("store");
  });
  it("deduplicates requests and resumes confirmed custody after recreating the service", async () => {
    const test = setup();
    const input = {
      workspace: supplier,
      requestKey: "receive-1",
      action: "receive" as const,
      productIds: [demoSerial(1), demoSerial(1)],
    };
    const one = await test.service.submit(input);
    const two = await test.service.submit(input);
    expect(one.id).toBe(two.id);
    expect(one.items).toHaveLength(1);
    expect(
      (await test.service.snapshot()).products.find(
        (p) => p.id === demoSerial(1),
      )!.stage,
    ).toBe(Stage.Dispatched);
    test.advance();
    const state = await test.reopen().snapshot();
    const p = state.products.find((p) => p.id === demoSerial(1))!;
    expect(p.stage).toBe(Stage.Delivered);
    expect(p.custodianId).toBe("warehouse");
    expect(p.history.filter((h) => h.action === "receive")).toHaveLength(1);
    await test.service.snapshot();
    expect((await test.service.snapshot()).operations).toHaveLength(1);
  });
  it("keeps successful items when a batch partly fails and retries only the failed item", async () => {
    const t = setup("partial");
    await t.service.submit({
      workspace: supplier,
      requestKey: "batch",
      action: "receive",
      productIds: [demoSerial(1), demoSerial(2)],
    });
    t.advance();
    const s = await t.service.snapshot();
    expect(s.operations[0].items.map((i) => i.status)).toEqual([
      "confirmed",
      "failed",
    ]);
    await t.service.submit({
      workspace: supplier,
      requestKey: "retry",
      action: "receive",
      productIds: [demoSerial(2)],
    });
    t.advance();
    expect((await t.service.snapshot()).operations[0].items[0].status).toBe(
      "confirmed",
    );
    await expect(
      t.service.submit({
        workspace: supplier,
        requestKey: "duplicate",
        action: "receive",
        productIds: [demoSerial(1)],
      }),
    ).rejects.toThrow();
  });
  it("blocks a second in-flight operation and checks revocation again before completion", async () => {
    const t = setup();
    await t.service.submit({
      workspace: supplier,
      requestKey: "dispatch",
      action: "dispatch",
      productIds: [demoSerial(3)],
      recipientId: "store",
    });
    await expect(
      t.service.submit({
        workspace: supplier,
        requestKey: "other",
        action: "dispatch",
        productIds: [demoSerial(3)],
        recipientId: "partner-hub",
      }),
    ).rejects.toThrow(/in progress/);
    await t.service.setFacilityStatus(admin, "warehouse", "revoked");
    t.advance();
    const s = await t.service.snapshot();
    expect(s.operations[0].items[0].status).toBe("failed");
    expect(s.products.find((p) => p.id === demoSerial(3))!.stage).toBe(
      Stage.Delivered,
    );
    await expect(
      t.service.setFacilityStatus(admin, "warehouse", "active"),
    ).rejects.toThrow(/cannot be automatically restored/);
  });
  it("rejects omitted/invalid dispatch destinations and scopes administrative actions", async () => {
    const t = setup();
    const input = {
      workspace: supplier,
      requestKey: "dispatch",
      action: "dispatch" as const,
      productIds: [demoSerial(3)],
    };
    await expect(t.service.submit(input)).rejects.toThrow(
      /Choose a destination/,
    );
    await expect(
      t.service.submit({ ...input, recipientId: "factory" }),
    ).rejects.toThrow(/eligible/);
    await expect(
      t.service.setFacilityStatus(supplier, "store", "revoked"),
    ).rejects.toThrow(/admin/);
  });
  it("saves offline capture without pretending to record a receipt", async () => {
    const t = setup("offline");
    await t.service.saveDraft({
      facilityId: supplier.facilityId,
      task: "receive",
      codes: [demoSerial(1)],
    });
    await expect(
      t.service.submit({
        workspace: supplier,
        requestKey: "offline",
        action: "receive",
        productIds: [demoSerial(1)],
      }),
    ).rejects.toThrow(/offline/);
    const s = await t.reopen().snapshot();
    expect(s.drafts[0].codes).toHaveLength(1);
    expect(s.operations).toHaveLength(0);
  });
});
