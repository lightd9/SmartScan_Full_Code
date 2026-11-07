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
import { capability } from "../domain/rules";
import { enterpriseService } from "../services";
import { LocationPolicy, RecordedLocation } from "../design/LocationNote";
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
  const { data, workspace: w, facility: f } = useBusiness();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [qr, setQr] = useState(false);
  const [recall, setRecall] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const p = data?.products.find((p) => p.id === id);
  if (!data || !w || !f) return null;
  if (!p)
    return (
      <main className="page">
        <PageTitle back title="Product" />
        <Empty title="Product not found">
          This serial is not in the demo records.
        </Empty>
      </main>
    );
  const custodian = data.facilities.find((f) => f.id === p.custodianId);
  const destination = data.facilities.find((f) => f.id === p.recipientId);
  const action: Action | undefined = (
    ["register", "receive", "dispatch", "sell"] as Action[]
  ).find((a) => !capability(p, a, f, w));
  const labels: Record<Action, string> = {
    register: "Continue registration",
    receive: "Receive this item",
    dispatch: "Dispatch this item",
    sell: "Sell this item",
    recall: "Recall product",
  };
  const pending = data.operations.find((o) =>
    o.items.some((i) => i.productId === p.id && i.status === "submitted"),
  );
  async function submit(action: "register" | "recall") {
    if (!p || !w || busy) return;
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
      await refresh();
      setRecall(false);
      navigate(`/operations/${op.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <PageTitle
        back
        title="Product passport"
        action={
          <button
            className="circle raised"
            aria-label="Show product QR"
            onClick={() => setQr(true)}
          >
            <QrCode size={21} />
          </button>
        }
      />
      <article className="passport">
        <ProductArt product={p} large />
        <div className="passport-body">
          <ProductBadge product={p} />
          <h2>{p.name}</h2>
          <p>{p.brand}</p>
          <span className="serial">{p.id}</span>
          <div className="detail-pairs">
            <div>
              <small>Registration</small>
              <strong>
                {p.registration === "confirmed"
                  ? "Confirmed in demo"
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
              onClick={() =>
                action === "register"
                  ? void submit("register")
                  : action === "sell"
                    ? navigate(`/review?task=sell&product=${p.id}`)
                    : navigate(`/scan?task=${action}&product=${p.id}`)
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
          {action === "register" && <LocationPolicy address={f.location} />}
        </div>
      </article>
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
                  "Recorded facility"}
              </p>
              {h.recipientId && (
                <p>
                  To {data.facilities.find((f) => f.id === h.recipientId)?.name}
                </p>
              )}
              {h.note && <p>{h.note}</p>}
              <RecordedLocation location={h.location} />
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
      <p className="simulation-note">
        Demo passport · sample identity and custody records.
      </p>
      {qr && (
        <Sheet title="Product QR & label" onClose={() => setQr(false)}>
          <div className="print-area label-preview">
            <Badge>DEMO LABEL</Badge>
            <h3>{p.name}</h3>
            <p>{p.brand}</p>
            <QRCodeSVG
              value={verificationUrl(p.id)}
              size={156}
              level="M"
              marginSize={3}
            />
            <code>{p.id}</code>
            <p>Sample product · for demonstration only</p>
          </div>
          <p className="support">
            This uses the configured public verification address. Sample serials
            are not registered on the live network.
          </p>
          {p.registration === "confirmed" ? (
            <Primary onClick={() => window.print()}>
              <FileDown size={18} />
              Print / save label
            </Primary>
          ) : (
            <p className="info-note">
              Label output becomes available after registration is confirmed.
            </p>
          )}
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
              Demo only · no live product will be affected.
            </p>
            <Primary busy={busy} disabled={!reason.trim()}>
              Confirm demo recall
              <Flag size={17} />
            </Primary>
          </form>
        </Sheet>
      )}
    </main>
  );
}
