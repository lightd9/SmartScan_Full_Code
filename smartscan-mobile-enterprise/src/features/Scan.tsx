import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Keyboard,
  Plus,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useBusiness, useRefresh } from "../app/context";
import { enterpriseService, isLive } from "../services";
import { capability, nextScanTask, parseCode } from "../domain/rules";
import { type Product, type Task } from "../domain/types";
import {
  ErrorNote,
  Empty,
  Loading,
  PageTitle,
  Primary,
  ProductRow,
  SectionTitle,
  Sheet,
} from "../design/ui";
import { feedback } from "../platform/feedback";

const Camera = lazy(() => import("../platform/Camera"));
export const taskNames: Record<Task, string> = {
  receive: "Receive",
  dispatch: "Dispatch",
  sell: "Sell",
};
export default function Scan() {
  const { data, workspace: w, facility: f, notify } = useBusiness();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tasks: Task[] =
    w?.role === "manufacturer"
      ? ["dispatch"]
      : w?.role === "retailer"
        ? ["sell", "receive"]
        : ["receive", "dispatch"];
  const request = params.get("task") as Task;
  const task = tasks.includes(request) ? request : tasks[0];
  const [manual, setManual] = useState(false);
  const [samples, setSamples] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [scanNotice, setScanNotice] = useState("");
  const [suggestion, setSuggestion] = useState<{ product: Product; task: Task } | null>(null);
  const processing = useRef(Promise.resolve());
  const seeded = useRef("");
  const draft = data?.drafts.find(
    (d) => d.facilityId === f?.id && d.task === task,
  );
  const codes = draft?.codes || [];
  const offline = data?.scenario === "offline" || !navigator.onLine;
  function reason(p?: Product) {
    if (p && data?.operations.some((op) => op.items.some((item) => item.productId === p.id && item.status === "submitted")))
      return "An action is already in progress for this item.";
    return !p
      ? isLive ? 'Not found in the current SmartScan inventory.' : "Not found in demo records."
      : offline
        ? "Waiting for verification. Reconnect to continue."
        : w && f
          ? capability(p, task, f, w)
          : "Select a facility.";
  }
  async function addCode(raw: string) {
    processing.current = processing.current
      .catch(() => {})
      .then(async () => {
        if (!w || !f) return;
        try {
          const serial = parseCode(
            raw,
            import.meta.env.VITE_VERIFICATION_ORIGIN ||
              "https://smart-scan-ten.vercel.app",
          );
          const latest = await enterpriseService.snapshot();
          const product = latest.products.find((p) => p.id === serial);
          const next = product && !offline ? nextScanTask(product, f, w, latest.operations) : null;
          if (product && next && next !== task) {
            setSamples(false);
            setManual(false);
            setSuggestion({ product, task: next });
            setError("");
            setCode("");
            void feedback("captured");
            return;
          }
          const existing =
            latest.drafts.find((d) => d.facilityId === f.id && d.task === task)
              ?.codes || [];
          if (existing.includes(serial)) {
            setScanNotice("Already in this session. Each serial counts once.");
            void feedback("exception");
            return;
          }
          await enterpriseService.saveDraft({
            facilityId: f.id,
            task,
            codes: [...existing, serial],
          });
          await refresh();
          const p = latest.products.find((p) => p.id === serial);
          const issue = reason(p);
          setScanNotice(
            issue
              ? "Item captured with an exception. Check the session below."
              : "Item captured. Ready for the next one.",
          );
          void feedback(issue ? "exception" : "captured");
          if (!issue) notify("Product added");
          setError("");
          setCode("");
        } catch (e) {
          setError((e as Error).message);
          void feedback("exception");
        }
      });
    await processing.current;
  }
  const addRef = useRef(addCode);
  addRef.current = addCode;
  useEffect(() => {
    const id = params.get("product");
    const signature = `${f?.id}-${task}-${id}`;
    if (id && f && seeded.current !== signature) {
      seeded.current = signature;
      void addRef.current(id);
    }
  }, [f?.id, task, params]);
  if (!data || !w || !f) return <Loading />;
  if (w.role === "admin") return <Navigate to="/inventory" replace />;
  const ready = codes.filter(
    (id) => !reason(data.products.find((p) => p.id === id)),
  );
  const candidates = [...data.products].sort(
    (a, b) => Number(Boolean(reason(a))) - Number(Boolean(reason(b))),
  );
  const pickerProducts =
    task === "sell"
      ? candidates.filter((p) => !capability(p, task, f, w))
      : candidates;
  async function remove(id?: string) {
    try {
      await processing.current;
      const latest = await enterpriseService.snapshot();
      const current =
        latest.drafts.find((d) => d.facilityId === f!.id && d.task === task)
          ?.codes || [];
      await enterpriseService.saveDraft({
        facilityId: f!.id,
        task,
        codes: id ? current.filter((c) => c !== id) : [],
      });
      await refresh();
      notify(id ? "Product removed" : "Session cleared");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="page scan-page">
      <PageTitle title="Scan product" subtitle={f.name} />
      <div className="task-switch" role="group" aria-label="Scanner task">
        {tasks.map((t) => (
          <button
            key={t}
            aria-pressed={task === t}
            className={task === t ? "selected" : ""}
            onClick={() => {
              setParams({ task: t }, { replace: true });
              setError("");
              setScanNotice("");
              setSuggestion(null);
            }}
          >
            {taskNames[t]}
          </button>
        ))}
      </div>
      <Suspense fallback={<Loading />}>
        <Camera onCode={addCode} paused={manual || samples || confirmClear || !!suggestion} />
      </Suspense>
      <div className="capture-actions">
        <button onClick={() => setManual(true)}>
          <Keyboard size={18} />
          Enter serial
        </button>
        <button onClick={() => setSamples(true)}>
          <Plus size={18} />
          {isLive || task === "sell" ? "Choose from inventory" : "Try demo items"}
        </button>
      </div>
      <p className="capture-feedback" role="status">
        {scanNotice || "Capture items here. Review before recording an action."}
      </p>
      <ErrorNote>{error}</ErrorNote>
      <SectionTitle title={`This session · ${codes.length}`}>
        {codes.length > 0 && (
          <button className="text-button" onClick={() => setConfirmClear(true)}>
            Clear
          </button>
        )}
      </SectionTitle>
      {!codes.length ? (
        <div className="session-empty">
          <ScanLine size={25} />
          <p>
            Ready for the first item.
            <span>
              {task === "sell"
                ? "Scan one item or choose from inventory. Add more for a larger sale."
                : "Keep scanning to collect a delivery. Repeated codes count once."}
            </span>
          </p>
        </div>
      ) : (
        <div className="scan-queue">
          {codes.map((id) => {
            const p = data.products.find((p) => p.id === id);
            const issue = reason(p);
            const next = p && !offline ? nextScanTask(p, f, w, data.operations) : null;
            return (
              <div
                className={`queue-item ${issue ? "has-issue" : ""}`}
                key={id}
              >
                <span className={`queue-dot ${issue ? "issue" : ""}`}>
                  {issue ? "!" : <Check size={13} />}
                </span>
                <div>
                  <strong>{p?.name || "Unknown item"}</strong>
                  <small>…{id.slice(-12)}</small>
                  {issue && <p>{issue}</p>}
                  {issue && next && next !== task && (
                    <button className="text-button queue-next-action" onClick={() => navigate(`/review?task=${next}&product=${id}`)}>
                      Review {next === "receive" ? "receipt" : next === "sell" ? "sale" : "dispatch"}
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
                <button
                  className="remove-item"
                  aria-label={`Remove ${p?.name || id}`}
                  onClick={() => void remove(id)}
                >
                  <X size={17} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {codes.length > 0 && (
        <div className="sticky-action">
          <div>
            <strong>{ready.length} ready</strong>
            <span>
              {codes.length - ready.length
                ? `${codes.length - ready.length} need attention`
                : "Review the details before recording"}
            </span>
          </div>
          <Primary
            disabled={!ready.length}
            onClick={() => navigate(`/review?task=${task}`)}
          >
            Review
            <ArrowRight size={17} />
          </Primary>
        </div>
      )}
      {manual && (
        <Sheet title="Enter a serial number" onClose={() => setManual(false)}>
          <p className="support">
            Use the serial on the product label. USB or Bluetooth scanners can
            also enter a code here.
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              await addCode(code);
              setManual(false);
            }}
          >
            <label htmlFor="serial">Product serial</label>
            <input
              id="serial"
              data-autofocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              placeholder="SS-…"
              required
              maxLength={300}
            />
            <Primary disabled={!code.trim()}>
              Add to session
              <Plus size={17} />
            </Primary>
          </form>
        </Sheet>
      )}
      {samples && (
        <Sheet
          title={task === "sell" ? "Choose items to sell" : isLive ? 'Choose from inventory' : "Try a demo item"}
          onClose={() => setSamples(false)}
        >
          <p className="support">
            {task === "sell"
              ? "Add individual items held by this store. Check the serial on the label, then review your selection before recording the sale."
              : "Add sample products to explore eligible items, wrong recipients, and recalled products. This does not access live records."}
          </p>
          <div className="product-list">
            {pickerProducts.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                detail={
                  task === "sell"
                    ? `${p.brand} · …${p.id.slice(-6)}${codes.includes(p.id) ? " · In session" : ""}`
                    : reason(p) || `Ready to ${task}`
                }
                end={
                  codes.includes(p.id) ? (
                    <Check size={18} />
                  ) : (
                    <Plus size={18} />
                  )
                }
                onClick={() => void addCode(p.id)}
              />
            ))}
          </div>
          {!pickerProducts.length && (
            <Empty title="No items ready to sell">
              Receive custody of products before adding them to a sale.
            </Empty>
          )}
          {task === "sell" && (
            <Primary className="full spaced" onClick={() => setSamples(false)}>
              Done
              <Check size={18} />
            </Primary>
          )}
        </Sheet>
      )}
      {confirmClear && (
        <Sheet
          title="Clear this scan session?"
          onClose={() => setConfirmClear(false)}
        >
          <p className="support">
            This removes the collected codes for this task and facility.
            Previously recorded operations stay in your activity.
          </p>
          <Primary
            onClick={async () => {
              await remove();
              setConfirmClear(false);
            }}
          >
            Clear session
            <Trash2 size={17} />
          </Primary>
        </Sheet>
      )}
      {suggestion && (
        <Sheet title={`Ready to ${suggestion.task}`} onClose={() => setSuggestion(null)}>
          <ProductRow product={suggestion.product} />
          <p className="support">
            {suggestion.task === "dispatch"
              ? "This product is already in your custody. You can prepare its next dispatch."
              : suggestion.task === "sell"
                ? "This product is in your store’s custody and ready for sale."
                : "This product is awaiting receipt at your facility."}
          </p>
          <Primary onClick={() => navigate(`/review?task=${suggestion.task}&product=${suggestion.product.id}`)}>
            Review {suggestion.task === "receive" ? "receipt" : suggestion.task === "sell" ? "sale" : "dispatch"}
            <ArrowRight size={17} />
          </Primary>
        </Sheet>
      )}
    </main>
  );
}
