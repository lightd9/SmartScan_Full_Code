import { useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useBusiness, useRefresh, useWorkspace } from "../app/context";
import { enterpriseService } from "../services";
import { LocationPolicy } from "../design/LocationNote";
import { capability, eligibleRecipient } from "../domain/rules";
import { type Product, type Task } from "../domain/types";
import {
  Empty,
  ErrorNote,
  PageTitle,
  Primary,
  ProductRow,
  SectionTitle,
} from "../design/ui";

export default function Review() {
  const [params] = useSearchParams();
  const { workspace } = useWorkspace();
  const task = params.get("task") as Task;
  const productId = task === "sell" ? params.get("product") : null;
  if (!["receive", "dispatch", "sell"].includes(task))
    return <Navigate to="/scan" replace />;
  return (
    <ReviewTask
      key={`${workspace?.facilityId}-${task}-${productId || "session"}`}
      task={task}
      productId={productId}
    />
  );
}

function ReviewTask({
  task,
  productId,
}: {
  task: Task;
  productId: string | null;
}) {
  const { data, workspace: w, facility: f } = useBusiness();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [recipient, setRecipient] = useState("__open__");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    productId ? [productId] : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  if (!data || !w || !f) return null;
  const draft = data.drafts.find(
    (d) => d.facilityId === f.id && d.task === task,
  );
  const codes = productId ? [productId] : draft?.codes || [];
  const products = codes
    .map((id) => data.products.find((p) => p.id === id))
    .filter((p): p is Product => !!p && !capability(p, task, f, w));
  const selected =
    task === "sell"
      ? products.filter((p) => selectedIds.includes(p.id))
      : products;
  const allSelected =
    products.length > 0 && selected.length === products.length;
  const excluded = codes.length - products.length;
  const destinations = data.facilities.filter((r) => eligibleRecipient(f, r));
  const offline = data.scenario === "offline" || !navigator.onLine;
  async function submit() {
    if (busy || !w || !selected.length || offline) return;
    setBusy(true);
    setError("");
    try {
      const op = await enterpriseService.submit({
        requestKey: key.current,
        workspace: w,
        action: task,
        productIds: selected.map((p) => p.id),
        ...(task === "dispatch"
          ? {
              recipientId: recipient === "__open__" ? null : recipient,
            }
          : {}),
      });
      await refresh();
      navigate(`/operations/${op.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      await refresh();
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <PageTitle
        back
        title={`Review ${task === "receive" ? "receipt" : task === "sell" ? "sale" : "dispatch"}`}
        subtitle="One last look before recording"
      />
      <div className="review-intro">
        <span className="empty-icon">
          {task === "receive" ? (
            <ArrowDownLeft />
          ) : task === "dispatch" ? (
            <ArrowUpRight />
          ) : (
            <ShieldCheck />
          )}
        </span>
        <h2 aria-live="polite" aria-atomic="true">
          {selected.length} item{selected.length === 1 ? "" : "s"} to {task}
        </h2>
        <p>
          {task === "receive"
            ? "Confirm these products have physically arrived at your facility."
            : task === "dispatch"
              ? "Record the handover and the intended destination."
              : "Record the sale of items held by this store. Payment is handled separately."}
        </p>
      </div>
      <div className="review-context">
        <Building2 size={21} />
        <div>
          <small>ACTING FACILITY</small>
          <strong>{f.name}</strong>
          <span>
            {f.code} · {f.location}
          </span>
        </div>
      </div>
      {task === "dispatch" && (
        <div className="form destination-form">
          <label htmlFor="recipient">Destination</label>
          <select
            id="recipient"
            value={recipient}
            disabled={busy}
            onChange={(e) => setRecipient(e.target.value)}
          >
            <option value="__open__">
              Open dispatch — eligible receiver claims
            </option>
            {destinations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.code}
              </option>
            ))}
          </select>
          <p className="support">
            {recipient === "__open__"
              ? `Any eligible registered ${f.role === "manufacturer" ? "supplier" : "supplier or retailer"} can claim this delivery. No specific destination is reserved.`
              : "Only the chosen facility can confirm receipt of this dispatch."}
          </p>
        </div>
      )}
      <SectionTitle
        title={task === "sell" ? "Choose items to sell" : "Included items"}
      >
        {task === "sell" && products.length > 1 && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              setSelectedIds(allSelected ? [] : products.map((p) => p.id))
            }
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        )}
      </SectionTitle>
      {task === "sell" && products.length > 0 && (
        <p className="support sale-selection-help">
          {productId
            ? "Only this item will be sold. Your other items stay in custody."
            : "Select the items for this sale. Unselected items stay in your session and in custody."}
        </p>
      )}
      <div className="product-list">
        {products.map((p) =>
          task === "sell" ? (
            <div
              key={p.id}
              className={`sale-choice ${selectedIds.includes(p.id) ? "selected" : ""}`}
            >
              <ProductRow
                product={p}
                end={
                  <span className="sale-check" aria-hidden="true">
                    {selectedIds.includes(p.id) && <Check size={16} />}
                  </span>
                }
              />
              <input
                type="checkbox"
                aria-label={`Sell ${p.name}, serial ${p.id}`}
                checked={selectedIds.includes(p.id)}
                disabled={busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedIds((current) =>
                    checked
                      ? [...current, p.id]
                      : current.filter((id) => id !== p.id),
                  );
                }}
              />
            </div>
          ) : (
            <ProductRow
              key={p.id}
              product={p}
              end={<ShieldCheck size={17} />}
            />
          ),
        )}
      </div>
      {excluded > 0 && !productId && (
        <p className="info-note">
          {excluded} item{excluded === 1 ? "" : "s"} needing attention will stay
          in your scan session.{" "}
          {task === "sell"
            ? "Only selected items will be submitted."
            : "Only the items above will be submitted."}
        </p>
      )}
      {!products.length && (
        <Empty title="No eligible items">
          {productId
            ? "This item is no longer available for sale at this facility. Return to inventory to check its status."
            : "Return to scanning to review or add items for this task."}
        </Empty>
      )}
      <ErrorNote>{error}</ErrorNote>
      <LocationPolicy address={f.location} />
      {offline && (
        <p className="info-note">
          Reconnect before recording. Your scan session is saved.
        </p>
      )}
      <p className="simulation-note">
        Demo action · saved on this device. No live transaction will be sent.
      </p>
      <Primary
        className="full"
        busy={busy}
        disabled={!selected.length || offline}
        onClick={() => void submit()}
      >
        Confirm{" "}
        {task === "receive" ? "receipt" : task === "sell" ? "sale" : "dispatch"}
        {task === "sell" &&
          ` · ${selected.length} item${selected.length === 1 ? "" : "s"}`}
        <ArrowRight size={18} />
      </Primary>
    </main>
  );
}
