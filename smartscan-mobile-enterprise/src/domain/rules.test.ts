import { describe, expect, it } from "vitest";
import { createFixtures, demoSerial } from "../dev/fixtures";
import {
  belongsToView,
  capability,
  eligibleRecipient,
  parseCode,
} from "./rules";
import { Stage, type Workspace } from "./types";

describe("V2 custody capabilities", () => {
  const s = createFixtures();
  const facility = (id: string) => s.facilities.find((f) => f.id === id)!;
  const product = (n: number) =>
    s.products.find((p) => p.id === demoSerial(n))!;
  const workspace = (id: string): Workspace => ({
    accountId: facility(id).accountId,
    role: facility(id).role,
    facilityId: id,
  });
  it("separates registration confirmation from inventory and receiving eligibility", () => {
    expect(
      belongsToView(
        product(1),
        "held",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).toBe(false);
    expect(
      belongsToView(
        product(1),
        "incoming",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).toBe(true);
    expect(
      belongsToView(
        product(3),
        "held",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).toBe(true);
    expect(
      belongsToView(
        product(7),
        "all",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).toBe(false);
  });
  it("requires exact recipient and current custodian, including same-role facilities", () => {
    expect(
      capability(
        product(1),
        "receive",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).toBeNull();
    expect(
      capability(
        product(1),
        "receive",
        facility("warehouse-2"),
        workspace("warehouse-2"),
      ),
    ).toMatch(/another facility/);
    expect(
      capability(
        product(3),
        "dispatch",
        facility("warehouse-2"),
        workspace("warehouse-2"),
      ),
    ).toMatch(/not in/);
    expect(
      capability(product(6), "sell", facility("store"), workspace("store")),
    ).toBeNull();
    expect(
      capability(product(3), "sell", facility("store"), workspace("store")),
    ).toMatch(/not in/);
  });
  it("supports only the actual directed and open role transitions", () => {
    expect(eligibleRecipient(facility("factory"), facility("store"))).toBe(
      false,
    );
    expect(
      eligibleRecipient(facility("warehouse"), facility("partner-hub")),
    ).toBe(true);
    expect(eligibleRecipient(facility("warehouse"), facility("store"))).toBe(
      true,
    );
    const open = { ...product(1), recipientId: null };
    expect(
      capability(open, "receive", facility("store"), workspace("store")),
    ).toMatch(/not eligible/);
    expect(
      capability(
        open,
        "receive",
        facility("warehouse-2"),
        workspace("warehouse-2"),
      ),
    ).toBeNull();
    expect(
      capability(
        { ...product(5), recipientId: null },
        "receive",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).toMatch(/sender cannot/);
  });
  it("preserves recall authority after sale; recalled products cannot move", () => {
    const sold = { ...product(6), stage: Stage.Sold };
    expect(
      capability(sold, "recall", facility("factory"), workspace("factory")),
    ).toBeNull();
    expect(
      capability(sold, "recall", facility("admin-hq"), workspace("admin-hq")),
    ).toBeNull();
    expect(
      capability(sold, "recall", facility("warehouse"), workspace("warehouse")),
    ).not.toBeNull();
    for (const action of ["receive", "dispatch", "sell", "recall"] as const)
      expect(
        capability(
          product(8),
          action,
          facility("warehouse"),
          workspace("warehouse"),
        ),
      ).not.toBeNull();
  });
  it("blocks inactive facilities, forged workspace roles, and unknown stage", () => {
    expect(
      capability(
        product(3),
        "dispatch",
        { ...facility("warehouse"), status: "revoked" },
        workspace("warehouse"),
      ),
    ).toMatch(/revoked/);
    expect(
      capability(product(3), "dispatch", facility("warehouse"), {
        ...workspace("warehouse"),
        role: "admin",
      }),
    ).not.toBeNull();
    expect(
      capability(
        { ...product(3), stage: Stage.None },
        "dispatch",
        facility("warehouse"),
        workspace("warehouse"),
      ),
    ).not.toBeNull();
  });
  it("validates full QR URLs without accepting an arbitrary foreign origin", () => {
    expect(parseCode(demoSerial(1))).toBe(demoSerial(1));
    expect(
      parseCode(`https://smart-scan-ten.vercel.app/verify/${demoSerial(1)}`),
    ).toBe(demoSerial(1));
    expect(() =>
      parseCode(`https://unrelated.example/verify/${demoSerial(1)}`),
    ).toThrow();
    expect(() => parseCode("SS-invalid")).toThrow();
  });
});
