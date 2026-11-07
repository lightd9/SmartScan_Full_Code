import {
  Stage,
  type Action,
  type Facility,
  type Filter,
  type Product,
  type Workspace,
} from "./types";

export function capability(
  product: Product,
  action: Action,
  facility: Facility,
  workspace: Workspace,
): string | null {
  if (
    facility.accountId !== workspace.accountId ||
    facility.id !== workspace.facilityId ||
    facility.role !== workspace.role
  )
    return "This facility is not part of your workspace.";
  if (facility.status !== "active")
    return facility.status === "revoked"
      ? "This facility has been revoked."
      : "This facility is awaiting approval.";
  if (action === "register") {
    if (
      facility.role !== "manufacturer" ||
      product.manufacturerId !== facility.id
    )
      return "Only the owning manufacturer can register this item.";
    return ["pending_wallet", "needs_retry"].includes(product.registration)
      ? null
      : "Registration has already been submitted.";
  }
  if (product.registration !== "confirmed")
    return "Registration must be confirmed first.";
  if (product.stage === Stage.Recalled)
    return "This item has been recalled. Normal operations are blocked.";
  if (action === "recall")
    return facility.role === "admin" || product.manufacturerId === facility.id
      ? null
      : "Only the original manufacturer or an admin can recall this item.";
  if (product.stage === Stage.Sold) return "This item has already been sold.";
  if (action === "receive") {
    if (!["supplier", "retailer"].includes(facility.role))
      return "This role cannot receive deliveries.";
    if (product.stage !== Stage.Dispatched)
      return "This item is not awaiting delivery.";
    if (product.custodianId === facility.id)
      return "The sender cannot receive its own dispatch.";
    if (product.recipientId)
      return product.recipientId === facility.id
        ? null
        : "This delivery is addressed to another facility.";
    const eligible =
      product.senderRole === "manufacturer"
        ? facility.role === "supplier"
        : product.senderRole === "supplier" &&
          ["supplier", "retailer"].includes(facility.role);
    return eligible
      ? null
      : "This facility is not eligible for this open dispatch.";
  }
  if (product.custodianId !== facility.id)
    return "This item is not in this facility’s custody.";
  if (action === "dispatch") {
    if (!["manufacturer", "supplier"].includes(facility.role))
      return "This role cannot dispatch products.";
    return [Stage.Manufactured, Stage.Delivered].includes(product.stage)
      ? null
      : "Receive this item before dispatching it.";
  }
  if (action === "sell")
    return facility.role === "retailer" && product.stage === Stage.Delivered
      ? null
      : "Only a retailer holding a received item can record its sale.";
  return "This action is unavailable.";
}

export function eligibleRecipient(
  sender: Facility,
  recipient: Facility,
): boolean {
  return (
    sender.id !== recipient.id &&
    recipient.status === "active" &&
    (sender.role === "manufacturer"
      ? recipient.role === "supplier"
      : sender.role === "supplier" &&
        ["supplier", "retailer"].includes(recipient.role))
  );
}

export function belongsToView(
  p: Product,
  filter: Filter,
  f: Facility,
  w: Workspace,
): boolean {
  const own = p.custodianId === f.id;
  const incoming = !capability(p, "receive", f, w);
  const relevant =
    w.role === "admin" ||
    (w.role === "manufacturer"
      ? p.manufacturerId === f.id
      : own ||
        incoming ||
        p.recipientId === f.id ||
        p.history.some((h) => h.actorId === f.id));
  if (!relevant) return false;
  switch (filter) {
    case "incoming":
      return incoming;
    case "held":
      return (
        own &&
        p.registration === "confirmed" &&
        [Stage.Delivered, Stage.Manufactured].includes(p.stage)
      );
    case "outgoing":
      return own && p.stage === Stage.Dispatched;
    case "pending":
      return (
        w.role === "manufacturer" &&
        p.manufacturerId === f.id &&
        p.registration !== "confirmed"
      );
    case "sold":
      return own && p.stage === Stage.Sold;
    case "recalled":
      return p.stage === Stage.Recalled;
    default:
      return relevant;
  }
}

const serialPattern =
  /^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseCode(
  value: string,
  origin = "https://smart-scan-ten.vercel.app",
): string {
  const text = value.trim();
  if (serialPattern.test(text)) return text;
  try {
    const url = new URL(text);
    const match = /^\/verify\/(SS-[\da-f-]+)\/?$/i.exec(url.pathname);
    if (
      url.origin === new URL(origin).origin &&
      match &&
      serialPattern.test(match[1])
    )
      return match[1];
  } catch {
    /* Plain invalid input gets the same actionable message. */
  }
  throw new Error(
    "Use a SmartScan serial or a QR from the configured verification site.",
  );
}
