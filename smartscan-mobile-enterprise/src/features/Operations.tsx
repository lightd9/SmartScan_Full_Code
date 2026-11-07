import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useBusiness, useRefresh } from "../app/context";
import { enterpriseService, isLive } from "../services";
import { explorer } from '../services/config';
import { RecordedLocation } from "../design/LocationNote";
import { locationSourceLabel } from "../platform/location";
import { actionNames, type Operation, type Task } from "../domain/types";
import {
  ActionRow,
  Badge,
  Empty,
  ErrorNote,
  PageTitle,
  Primary,
  SectionTitle,
  Sheet,
  timeLabel,
} from "../design/ui";
import { feedback } from "../platform/feedback";
import { exportFile } from "../platform/files";

export const operationStatus = (o: Operation) =>
  o.items.some((i) => i.status === "submitted")
    ? "In progress"
    : o.items.some((i) => i.status === "failed")
      ? "Needs attention"
      : "Complete";
export function Activity() {
  const { data, workspace: w } = useBusiness();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  if (!data || !w) return null;
  const admin = w.role === "admin";
  const alerts = admin && params.get("view") === "alerts";
  const ops = data.operations.filter(
    (o) => admin || o.facilityId === w.facilityId,
  );
  return (
    <main className="page">
      <PageTitle
        title={admin ? "Operations" : "Activity"}
        subtitle={
          admin
            ? "A closer look at your network"
            : "A record of your facility’s work"
        }
      />
      {admin && (
        <div className="task-switch">
          <button
            className={!alerts ? "selected" : ""}
            onClick={() => setParams({})}
          >
            Activity
          </button>
          <button
            className={alerts ? "selected" : ""}
            onClick={() => setParams({ view: "alerts" })}
          >
            Scan alerts · {data.alerts.length}
          </button>
        </div>
      )}
      {alerts ? (
        data.alerts.length ? (
          <div className="alerts-list">
            {data.alerts.map((a) => (
              <article className="alert-card" key={a.id}>
                <Badge tone="amber">Review needed</Badge>
                <h2>{a.title}</h2>
                <p>{a.detail}</p>
                <small>{timeLabel(a.at)}</small>
                <button
                  className="text-button"
                  onClick={() => navigate(`/products/${a.productId}`)}
                >
                  View product history
                  <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No scan alerts">
            Alerts needing review will appear here.
          </Empty>
        )
      ) : (
        <>
          {ops.length ? (
            <div className="surface">
              {ops.map((o) => (
                <ActionRow
                  key={o.id}
                  icon={
                    operationStatus(o) === "Complete" ? (
                      <Check size={21} />
                    ) : (
                      <Clock3 size={21} />
                    )
                  }
                  title={`${actionNames[o.action]} · ${o.items.length} item${o.items.length === 1 ? "" : "s"}`}
                  detail={`${operationStatus(o)} · ${timeLabel(o.createdAt)}`}
                  onClick={() => navigate(`/operations/${o.id}`)}
                />
              ))}
            </div>
          ) : (
            <Empty title="A clear starting point" icon={<Clock3 size={25} />}>
              Your facility’s actions will appear here, including work still in
              progress.
            </Empty>
          )}
          {admin && data.audit.length > 0 && (
            <>
              <SectionTitle title="Administration" />
              <div className="surface">
                {data.audit.map((a) => (
                  <ActionRow
                    key={a.id}
                    icon={<ShieldCheck size={20} />}
                    title={a.title}
                    detail={`${a.detail} · ${timeLabel(a.at)}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
export default function OperationDetail() {
  const { id } = useParams();
  const { data, workspace: w, facility: f, notify } = useBusiness();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const receiptRef = useRef<HTMLElement>(null);
  const notified = useRef(false);
  const o = data?.operations.find(
    (o) => o.id === id && (w?.role === "admin" || o.accountId === w?.accountId),
  );
  const status = o ? operationStatus(o) : "";
  useEffect(() => {
    if (status === "Complete" && !notified.current) {
      notified.current = true;
      void feedback("confirmed");
    }
  }, [status]);
  if (!data || !w || !f) return null;
  if (!o)
    return (
      <main className="page">
        <PageTitle back title="Operation" />
        <Empty title="Operation unavailable">
          Return to your activity to find this facility’s work.
        </Empty>
      </main>
    );
  const complete = o.items.filter((i) => i.status === "confirmed");
  const failed = o.items.filter((i) => i.status === "failed");
  const pending = o.items.some((i) => i.status === "submitted");
  const acting = data.facilities.find((f) => f.id === o.facilityId);
  async function retry() {
    if (!o || !w || busy) return;
    setBusy(true);
    setError("");
    try {
      if (o.facilityId !== w.facilityId)
        throw new Error("Switch to the operation’s facility before retrying.");
      if (["receive", "dispatch", "sell"].includes(o.action)) {
        const current =
          data!.drafts.find(
            (d) => d.facilityId === o.facilityId && d.task === o.action,
          )?.codes || [];
        await enterpriseService.saveDraft({
          facilityId: o.facilityId,
          task: o.action as Task,
          codes: [...current, ...failed.map((i) => i.productId)],
        });
        await refresh();
        navigate(`/scan?task=${o.action}`);
      } else {
        navigate(`/products/${failed[0].productId}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function saveFile(blob: Blob, filename: string, title: string) {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const result = await exportFile(blob, filename, title);
      if (result === "downloaded") notify("File downloaded");
    } catch (e) { setError((e as Error).message); }
    finally { setExporting(false); }
  }
  function exportManifest() {
    const escape = (value: string) => {
      const text = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Operation", "Action", "Facility", "Serial", "Status", "Note", "Location", "Location source", "Latitude", "Longitude", "Captured at", 'Transaction hash'],
      ...o!.items.map((i) => [
        o!.id,
        o!.action,
        acting?.code || "",
        i.productId,
        i.status,
        i.message || (isLive ? '' : "Demo only"),
        o!.location?.address || "",
        locationSourceLabel(o!.location),
        o!.location?.latitude?.toString() || "",
        o!.location?.longitude?.toString() || "",
        o!.location?.capturedAt || "",
        i.txHash || '',
      ]),
    ];
    void saveFile(new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }), `smartscan-operation-${o!.id}.csv`, "Operation manifest");
  }
  function exportReceipt() {
    if (!receiptRef.current) return;
    // React has already escaped all receipt text. The exported document is
    // self-contained, with no scripts, remote fonts, or external resources.
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>SmartScan receipt</title><style>body{font:16px system-ui,sans-serif;color:#000336;margin:32px auto;padding:0 20px;max-width:600px}article>span,small{display:block}code{display:block;font-size:12px;overflow-wrap:anywhere}.receipt-items>div{padding:16px 0;border-bottom:1px solid #ddd}.recorded-location{margin:20px 0}svg{display:none}h2{font-size:24px}</style></head><body>${receiptRef.current.outerHTML}</body></html>`;
    void saveFile(new Blob([html], { type: "text/html;charset=utf-8" }), `smartscan-receipt-${o!.id}.html`, "Sale receipt");
  }
  return (
    <main className="page">
      <PageTitle
        back
        title={`${actionNames[o.action]} details`}
        subtitle={timeLabel(o.createdAt)}
      />
      <div className={`operation-hero ${failed.length ? "has-failure" : ""}`}>
        <span className="operation-seal">
          {pending ? (
            <LoaderCircle className="spin" size={30} />
          ) : failed.length ? (
            <RefreshCw size={28} />
          ) : (
            <Check size={30} />
          )}
        </span>
        <Badge tone={pending || failed.length ? "amber" : "blue"}>
          {status}
        </Badge>
        <h2>
          {pending
            ? "Recording your action."
            : failed.length
              ? "Some items need a look."
              : "All accounted for."}
        </h2>
        <p>
          {pending
            ? "You can leave this screen. Progress is saved and will be checked when you return."
            : failed.length
              ? "Completed items are saved. Review the remaining items before trying again."
              : isLive ? 'Blockchain confirmation received. This operation is saved in your activity.' : "Your demo records are updated. This operation is saved in your activity."}
        </p>
        <span className="progress-label">
          {complete.length} of {o.items.length} completed
        </span>
        <div className="progress-track">
          <i
            style={{ width: `${(complete.length / o.items.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="review-context">
        <ShieldCheck size={22} />
        <div>
          <small>ACTING FACILITY</small>
          <strong>{acting?.name}</strong>
          <span>
            {acting?.code} ·{" "}
            {o.recipientId
              ? `To ${data.facilities.find((f) => f.id === o.recipientId)?.name}`
              : o.action === "dispatch"
                ? "Open dispatch"
                : "Managed facility workspace"}
          </span>
        </div>
      </div>
      <RecordedLocation location={o.location} />
      <SectionTitle title="Item outcomes" />
      <div className="surface">
        {o.items.map((i) => (
          <ActionRow
            key={i.productId}
            icon={
              i.status === "confirmed" ? (
                <Check size={20} />
              ) : i.status === "failed" ? (
                <X size={20} />
              ) : (
                <Clock3 size={20} />
              )
            }
            title={
              data.products.find((p) => p.id === i.productId)?.name ||
              i.productId
            }
            detail={
              i.message ||
              (i.status === "confirmed"
                ? isLive ? 'Confirmed on chain' : "Recorded in demo"
                : i.phase === 'queued' ? 'Queued for wallet signing' : "Confirmation pending")
            }
            onClick={() => navigate(`/products/${i.productId}`)}
          />
        ))}
      </div>
      {isLive && o.items.some(i => i.txHash) && <div className="surface">
        {o.items.filter(i => i.txHash).map(i => <div key={i.productId} style={{ padding: 16 }}>
          <small>{i.productId}</small><br />
          <a href={`${explorer}/tx/${i.txHash}`} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
            {i.txHash}
          </a>
          {i.blockNumber && <p>Block {i.blockNumber}</p>}
        </div>)}
      </div>}
      {o.reason && <p className="info-note">Recall reason: {o.reason}</p>}
      <ErrorNote>{error}</ErrorNote>
      {!pending && failed.length > 0 && (
        <Primary
          className="full spaced"
          busy={busy}
          onClick={() => void retry()}
        >
          Review {failed.length} unfinished item{failed.length === 1 ? "" : "s"}
          <ArrowRight size={17} />
        </Primary>
      )}
      {!pending && complete.length > 0 && (
        <div className="operation-actions">
          {o.action === "sell" && (
            <Primary onClick={() => setReceipt(true)}>
              <FileText size={17} />
              View sale receipt
            </Primary>
          )}
          {o.action === "receive" &&
            o.facilityId === f.id &&
            ["manufacturer", "supplier"].includes(w.role) && (
              <Primary
                onClick={async () => {
                  try {
                    const latest = await enterpriseService.snapshot();
                    const existing = latest.drafts.find((draft) => draft.facilityId === f.id && draft.task === "dispatch")?.codes || [];
                    await enterpriseService.saveDraft({
                      facilityId: f.id,
                      task: "dispatch",
                      codes: [...new Set([...existing, ...complete.map((i) => i.productId)])],
                    });
                    await refresh();
                    navigate("/scan?task=dispatch");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Prepare dispatch
                <ArrowRight size={17} />
              </Primary>
            )}
          <button className="secondary" onClick={exportManifest} disabled={exporting}>
            <Download size={17} />
            Export manifest
          </button>
        </div>
      )}
      <p className="simulation-note">
        {isLive ? 'Sepolia operation · payment handled separately. Reference ' : 'Demo operation · no blockchain transaction or payment. Reference '}
        {o.id.slice(0, 8)}.
      </p>
      {receipt && (
        <Sheet title="Sale receipt" onClose={() => setReceipt(false)}>
          <article className="print-area receipt" ref={receiptRef}>
            <span className="eyebrow">SMARTSCAN</span>
            <h2>{acting?.name}</h2>
            <Badge>{isLive ? 'SALE RECORD' : 'DEMO SALE RECEIPT'}</Badge>
            <p>{timeLabel(o.createdAt)}</p>
            <RecordedLocation location={o.location} />
            <div className="receipt-items">
              {complete.map((i) => (
                <div key={i.productId}>
                  <strong>
                    {data.products.find((p) => p.id === i.productId)?.name}
                  </strong>
                  <code>{i.productId}</code>
                </div>
              ))}
            </div>
            <p>
              {isLive ? 'Sale recorded on Sepolia.' : 'Sale recorded in the local demo.'}
              <br />
              This is not a payment receipt or live warranty.
            </p>
            <code>Reference: {o.id}</code>
          </article>
          <ErrorNote>{error}</ErrorNote>
          <Primary onClick={exportReceipt} busy={exporting}>
            <Download size={18} />
            Save / share receipt
          </Primary>
        </Sheet>
      )}
    </main>
  );
}
