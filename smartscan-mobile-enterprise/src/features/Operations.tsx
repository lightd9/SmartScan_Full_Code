import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
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
import { enterpriseService } from "../services";
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
import { verificationUrl } from "./Product";

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
  const { data, workspace: w, facility: f } = useBusiness();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  function exportManifest() {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ["Demo operation", "Action", "Facility", "Serial", "Status", "Note", "Location", "Location source", "Latitude", "Longitude", "Captured at"],
      ...o!.items.map((i) => [
        o!.id,
        o!.action,
        acting?.code || "",
        i.productId,
        i.status,
        i.message || "Demo only",
        o!.location?.address || "",
        locationSourceLabel(o!.location),
        o!.location?.latitude?.toString() || "",
        o!.location?.longitude?.toString() || "",
        o!.location?.capturedAt || "",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `smartscan-demo-${o!.id}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
              : "Your demo records are updated. This operation is saved in your activity."}
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
                ? "Recorded in demo"
                : "Confirmation pending")
            }
            onClick={() => navigate(`/products/${i.productId}`)}
          />
        ))}
      </div>
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
                    await enterpriseService.saveDraft({
                      facilityId: f.id,
                      task: "dispatch",
                      codes: complete.map((i) => i.productId),
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
          <button className="secondary" onClick={exportManifest}>
            <Download size={17} />
            Export manifest
          </button>
        </div>
      )}
      <p className="simulation-note">
        Demo operation · no blockchain transaction or payment. Reference{" "}
        {o.id.slice(0, 8)}.
      </p>
      {receipt && (
        <Sheet title="Sale receipt" onClose={() => setReceipt(false)}>
          <article className="print-area receipt">
            <span className="eyebrow">SMARTSCAN ENTERPRISE</span>
            <h2>{acting?.name}</h2>
            <Badge>DEMO SALE RECEIPT</Badge>
            <p>{timeLabel(o.createdAt)}</p>
            <RecordedLocation location={o.location} />
            <div className="receipt-items">
              {complete.map((i) => (
                <div key={i.productId}>
                  <strong>
                    {data.products.find((p) => p.id === i.productId)?.name}
                  </strong>
                  <code>{i.productId}</code>
                  <QRCodeSVG
                    value={verificationUrl(i.productId)}
                    size={120}
                    marginSize={3}
                  />
                </div>
              ))}
            </div>
            <p>
              Sale recorded in the local demo.
              <br />
              This is not a payment receipt or live warranty.
            </p>
            <code>Reference: {o.id}</code>
          </article>
          <Primary onClick={() => window.print()}>
            <Download size={18} />
            Print / save receipt
          </Primary>
        </Sheet>
      )}
    </main>
  );
}
