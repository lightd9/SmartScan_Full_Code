import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Clock3,
  FileDown,
  Flag,
  MapPin,
  QrCode,
} from "lucide-react";
import { useBusiness, useRefresh } from "../app/context";
import { actionNames, Stage, type Action } from "../domain/types";
import { canExportLabel, capability } from "../domain/rules";
import { enterpriseService, isLive } from "../services";
import { LocationPolicy, RecordedLocation } from "../design/LocationNote";
import { exportLabel } from "../platform/label";
import {
  Badge,
  Empty,
  ErrorNote,
  PageTitle,
  Primary,
  ProductArt,
  ProductBadge,
  SectionTitle,
  Sheet,
  timeLabel,
} from "../design/ui";

export const verificationUrl = (id: string) =>
  `${import.meta.env.VITE_VERIFICATION_ORIGIN || "https://smart-scan-ten.vercel.app"}/verify/${encodeURIComponent(id)}`;
export default function ProductDetail() {
  const { id } = useParams();
  const { data, workspace: w, facility: f, notify } = useBusiness();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [qr, setQr] = useState(false);
  const [recall, setRecall] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [exporting, setExporting] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);
  const submitting = useRef(false);
  const key = useRef(crypto.randomUUID());
  const p = data?.products.find((p) => p.id === id);
  if (!data || !w || !f) return null;
  if (!p)
    return (
      <main className="page">
        <PageTitle back title="Product" />
        <Empty title="Product not found">
          This serial is not in your current inventory.
        </Empty>
      </main>
    );
  const custodian = data.facilities.find((f) => f.id === p.custodianId);
  const labelsAllowed = canExportLabel(p, w, data.facilities);
  const offline = data.scenario === "offline" || !navigator.onLine;
  const destination = data.facilities.find((f) => f.id === p.recipientId);
  const action: Action | undefined = (
    ["register", "receive", "dispatch", "sell"] as Action[]
  ).find((a) => !capability(p, a, f, w));
  const labels: Record<Action, string> = {
    register: "Continue registration",
    receive: p.protocol === 'receipt-v3' ? 'Request receipt approval' : 'Receive this item',
    dispatch: "Dispatch this item",
    sell: "Sell this item",
    recall: "Recall product",
  };
  const pending = data.operations.find((o) =>
    o.items.some((i) => i.productId === p.id && ['submitted','waiting_approval'].includes(i.status)),
  );
  async function submit(action: "register" | "recall" | "receive") {
    if (!p || !w || submitting.current || offline) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const op = await enterpriseService.submit({
        requestKey: key.current,
        workspace: w,
        action,
        productIds: [p.id],
        reason,
      });
      void refresh();
      setRecall(false);
      navigate(`/operations/${op.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      submitting.current = false;
    }
  }
  async function saveLabel() {
    if (!p || !qrRef.current || !labelsAllowed || p.registration !== "confirmed" || exporting) return;
    setExporting(true);
    setLabelError("");
    try {
      const result = await exportLabel(p, qrRef.current);
      if (result === "downloaded") notify("Label downloaded");
      // Opening a share sheet does not prove that a file was saved or printed.
    } catch (e) {
      setLabelError((e as Error).message || "Label export failed. Please try again.");
    } finally { setExporting(false); }
  }
  return (
    <main className="page">
      <PageTitle
        back
        title="Product passport"
        action={
          labelsAllowed &&
          <button
            className="circle raised"
            aria-label="Show product QR"
            onClick={() => { setLabelError(""); setQr(true); }}
          >
            <QrCode size={21} />
          </button>
        }
      />
      <div className="product-layout">
      <article className="passport">
        <ProductArt product={p} large />
        <div className="passport-body">
          <ProductBadge product={p} />
          {isLive && <p className="support">{p.protocol==='receipt-v3' ? 'Receipt protocol · dispatch recorded off-chain' : 'Legacy V2 · dispatch and receipt on-chain'}</p>}
          <h2>{p.name}</h2>
          <p>{p.brand}</p>
          <span className="serial">{p.id}</span>
          <div className="detail-pairs">
            <div>
              <small>Registration</small>
              <strong>
                {p.registration === "confirmed"
                  ? isLive ? 'Confirmed on chain' : "Confirmed in demo"
                  : p.registration === "submitted"
                    ? "In progress"
                    : "Awaiting registration"}
              </strong>
            </div>
            <div>
              <small>Current custodian</small>
              <strong>{custodian?.name || "Unavailable"}</strong>
              {custodian?.location && <span>Profile address: {custodian.location}</span>}
            </div>
          </div>
          {p.stage === Stage.Dispatched && (
            <div className="destination-note">
              <MapPin size={17} />
              <span>
                Destination:{" "}
                {destination?.name || "Open to an eligible receiver"}
              </span>
            </div>
          )}
          {pending ? (
            <Primary
              className="full"
              onClick={() => navigate(`/operations/${pending.id}`)}
            >
              View operation progress
              <Clock3 size={18} />
            </Primary>
          ) : action ? (
            <Primary
              className="full"
              busy={busy}
              disabled={offline}
              onClick={() =>
                action === "register" || action === "receive"
                  ? void submit(action)
                  : navigate(`/review?task=${action}&product=${p.id}`)
              }
            >
              {labels[action]}
              <ArrowRight size={18} />
            </Primary>
          ) : (
            <p className="support">
              {p.stage === Stage.Recalled
                ? "This product is recalled. Receiving, dispatch, and sale are blocked."
                : p.stage === Stage.Sold
                  ? "The sale is recorded. Its provenance remains available."
                  : "No custody action is available for this facility at this stage."}
            </p>
          )}
          <ErrorNote>{error}</ErrorNote>
          {action === "receive" && <p className="support">{p.protocol==='receipt-v3' ? 'Only request receipt after physical arrival. Custody changes after sender approval and blockchain confirmation.' : 'Receive this item only once it has physically arrived. This records receipt immediately.'}</p>}
          {p.protocol==='receipt-v3' && p.custodianId===f.id && <button className="secondary full" onClick={()=>navigate('/handovers')}>Review handover requests</button>}
          {(action === "register" || action === "receive") && <LocationPolicy address={f.location} />}
        </div>
      </article>
      <section className="product-journey" aria-label="Product journey">
      <SectionTitle title="The journey so far" />
      <div className="surface journey">
        <ol>
          {p.history.map((h) => (
            <li key={h.id}>
              <span className="timeline-dot" />
              <small>{timeLabel(h.at)}</small>
              <h3>{actionNames[h.action]} recorded</h3>
              <p>
                {data.facilities.find((f) => f.id === h.actorId)?.name ||
                  h.actorName || "Recorded facility"}
              </p>
              {h.recipientId && (
                <p>
                  To {data.facilities.find((f) => f.id === h.recipientId)?.name}
                </p>
              )}
              {h.note && <p>{h.note}</p>}
              {(h.location || !isLive) && <RecordedLocation location={h.location} />}
            </li>
          ))}
        </ol>
        {!p.history.length && (
          <p className="support">
            The journey begins when registration is confirmed.
          </p>
        )}
      </div>
      {!capability(p, "recall", f, w) && (
        <button
          className="danger-link"
          onClick={() => {
            setError("");
            key.current = crypto.randomUUID();
            setRecall(true);
          }}
        >
          <Flag size={16} />
          Recall this product
        </button>
      )}
      </section>
      </div>
      <p className="simulation-note">
        {isLive ? 'Recorded identity and custody on Sepolia. A matching code alone does not prove physical authenticity.' : 'Demo passport · sample identity and custody records.'}
      </p>
      {qr && labelsAllowed && (
        <Sheet title="Product QR & label" onClose={() => setQr(false)}>
          <div className="print-area label-preview">
            <Badge>DEMO LABEL</Badge>
            <h3>{p.name}</h3>
            <p>{p.brand}</p>
            <QRCodeSVG
              ref={qrRef}
              value={verificationUrl(p.id)}
              size={156}
              level="M"
              marginSize={4}
            />
            <code>{p.id}</code>
            <p>{isLive ? 'SmartScan product label · Sepolia' : 'Sample product · for demonstration only'}</p>
          </div>
          <p className="support">
            This uses the configured public verification address. Sample serials
            are not registered on the live network.
          </p>
          {p.registration === "confirmed" ? (
            <Primary onClick={() => void saveLabel()} busy={exporting}>
              <FileDown size={18} />
              Save / share label
            </Primary>
          ) : (
            <p className="info-note">
              Label output becomes available after registration is confirmed.
            </p>
          )}
          <ErrorNote>{labelError}</ErrorNote>
          <p className="support">Export a clear label image to save or send to your printer app.</p>
        </Sheet>
      )}
      {recall && (
        <Sheet title="Recall this product?" onClose={() => setRecall(false)}>
          <p className="support">
            Recalling <strong>{p.name}</strong> blocks further receipt,
            dispatch, and sale. The contract has no undo-recall action.
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit("recall");
            }}
          >
            <label htmlFor="recall-reason">Reason for recall</label>
            <textarea
              id="recall-reason"
              data-autofocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
              placeholder="Explain why this product is being recalled"
            />
            <ErrorNote>{error}</ErrorNote>
            <LocationPolicy address={f.location} />
            <p className="simulation-note">
              {isLive ? 'Your wallet will record a recall for this product on Sepolia.' : 'Demo only · no live product will be affected.'}
            </p>
            <Primary busy={busy} disabled={!reason.trim()}>
              {isLive ? 'Confirm recall' : 'Confirm demo recall'}
              <Flag size={17} />
            </Primary>
          </form>
        </Sheet>
      )}
    </main>
  );
}
