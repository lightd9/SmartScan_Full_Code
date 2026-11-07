import {
  Stage,
  type DemoState,
  type Product,
  type Scenario,
} from "../domain/types";

export const demoSerial = (n: number) =>
  `SS-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function createFixtures(
  scenario: Scenario = "normal",
  now = Date.now(),
): DemoState {
  const at = (hours: number) => new Date(now - hours * 3600000).toISOString();
  const accounts: DemoState["accounts"] = [
    {
      id: "admin",
      name: "SmartScan Operations",
      username: "admin.demo",
      role: "admin",
    },
    {
      id: "maker",
      name: "Aster Laboratories",
      username: "aster.demo",
      role: "manufacturer",
    },
    {
      id: "supply",
      name: "Meridian Distribution",
      username: "meridian.demo",
      role: "supplier",
    },
    {
      id: "retail",
      name: "Wellside Pharmacy",
      username: "wellside.demo",
      role: "retailer",
    },
    {
      id: "partner",
      name: "Northline Distribution",
      username: "northline.demo",
      role: "supplier",
    },
  ];
  const facilities: DemoState["facilities"] = [
    {
      id: "admin-hq",
      accountId: "admin",
      name: "Operations office",
      code: "OPS-01",
      role: "admin",
      status: "active",
      location: "Lagos",
      wallet: `0x${"1".repeat(40)}`,
    },
    {
      id: "factory",
      accountId: "maker",
      name: "Ikeja production",
      code: "AST-01",
      role: "manufacturer",
      status: "active",
      location: "Ikeja, Lagos",
      wallet: `0x${"2".repeat(40)}`,
    },
    {
      id: "warehouse",
      accountId: "supply",
      name: "Lagos distribution hub",
      code: "MER-LAG",
      role: "supplier",
      status: "active",
      location: "Ikeja, Lagos",
      wallet: `0x${"3".repeat(40)}`,
    },
    {
      id: "warehouse-2",
      accountId: "supply",
      name: "Ibadan distribution hub",
      code: "MER-IBA",
      role: "supplier",
      status: "active",
      location: "Ibadan, Oyo",
      wallet: `0x${"4".repeat(40)}`,
    },
    {
      id: "store",
      accountId: "retail",
      name: "Victoria Island store",
      code: "WEL-VI",
      role: "retailer",
      status: "active",
      location: "Victoria Island, Lagos",
      wallet: `0x${"5".repeat(40)}`,
    },
    {
      id: "partner-hub",
      accountId: "partner",
      name: "Abuja distribution hub",
      code: "NOR-ABJ",
      role: "supplier",
      status: "active",
      location: "Abuja, FCT",
      wallet: `0x${"6".repeat(40)}`,
    },
    {
      id: "store-new",
      accountId: "retail",
      name: "Lekki store",
      code: "WEL-LKK",
      role: "retailer",
      status: "pending",
      location: "Lekki, Lagos",
      wallet: `0x${"7".repeat(40)}`,
    },
  ];
  const base = (
    n: number,
    name: string,
    kind: Product["kind"] = "carton",
  ): Product => ({
    id: demoSerial(n),
    name,
    brand: "Aster",
    kind,
    description:
      "A sample serialized product for exploring SmartScan Enterprise. This is demo data.",
    stage: Stage.Manufactured,
    registration: "confirmed",
    manufacturerId: "factory",
    custodianId: "factory",
    recipientId: null,
    version: 1,
    history: [
      { id: `m-${n}`, action: "register", actorId: "factory", at: at(48) },
    ],
  });
  const incoming = (
    p: Product,
    recipientId: string,
    senderId = "factory",
  ): Product => ({
    ...p,
    stage: Stage.Dispatched,
    custodianId: senderId,
    recipientId,
    senderRole: senderId === "factory" ? "manufacturer" : "supplier",
    history: [
      ...p.history,
      ...(senderId === "factory"
        ? []
        : [
            {
              id: `r-${p.id}`,
              action: "receive" as const,
              actorId: senderId,
              at: at(30),
            },
          ]),
      {
        id: `d-${p.id}`,
        action: "dispatch",
        actorId: senderId,
        recipientId,
        at: at(3),
      },
    ],
  });
  const held = (p: Product, custodianId = "warehouse"): Product => ({
    ...p,
    stage: Stage.Delivered,
    custodianId,
    history: [
      ...incoming(p, custodianId).history,
      { id: `r-${p.id}`, action: "receive", actorId: custodianId, at: at(2) },
    ],
  });
  const products: Product[] = [
    incoming(base(1, "Paracetamol · 500 mg"), "warehouse"),
    incoming(base(2, "Vitamin C · 60 tablets", "bottle"), "warehouse"),
    held(base(3, "Daily hydration serum", "bottle")),
    held(base(4, "First aid essentials")),
    incoming(
      held(base(5, "Vitamin D · 30 tablets", "bottle")),
      "store",
      "warehouse",
    ),
    held(base(6, "Gentle cleansing gel", "bottle"), "store"),
    incoming(base(7, "Electrolyte sachets"), "partner-hub"),
    {
      ...held(base(8, "Daily mineral complex", "bottle")),
      stage: Stage.Recalled,
      history: [
        ...held(base(8, "Daily mineral complex", "bottle")).history,
        {
          id: "recall-8",
          action: "recall",
          actorId: "factory",
          at: at(1),
          note: "Demo packaging quality review.",
        },
      ],
    },
    base(9, "Soothing skin cream"),
    {
      ...base(10, "Travel care essentials"),
      registration: "pending_wallet",
      stage: Stage.None,
    },
  ];
  if (scenario === "partial") products[1].failOnce = true;
  return {
    version: 1,
    scenario,
    accounts,
    facilities,
    products: scenario === "empty" ? [] : products,
    operations: [],
    drafts: [],
    audit: [],
    alerts:
      scenario === "empty"
        ? []
        : [
            {
              id: "alert-1",
              productId: demoSerial(8),
              title: "Scan of a recalled product",
              detail:
                "A demo scan references an item under recall. Review its recorded history and follow up with the custodian. A scan alert alone is not proof of counterfeiting.",
              at: at(1),
            },
          ],
  };
}
