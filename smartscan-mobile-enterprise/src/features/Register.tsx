import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, ImagePlus, X } from "lucide-react";
import { useBusiness, useRefresh } from "../app/context";
import { enterpriseService, isLive } from "../services";
import { ErrorNote, PageTitle, Primary } from "../design/ui";
import { LocationPolicy } from "../design/LocationNote";

type Draft = {
  id: string;
  name: string;
  brand: string;
  description: string;
  image?: string;
  kind: "bottle" | "carton";
};
export default function Register() {
  const { workspace: w, facility: f, data, notify } = useBusiness();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const key = `smartscan-${isLive ? 'live' : 'demo'}-registration-${w?.accountId}-${w?.facilityId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {
      /* Form remains usable if no valid draft exists. */
    }
    return {
      id: `SS-${crypto.randomUUID()}`,
      name: "",
      brand: "",
      description: "",
      kind: "carton",
    };
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const requestKey = useRef(crypto.randomUUID());
  if (!w || !f || !data) return null;
  if (w.role !== "manufacturer") return <Navigate to="/" replace />;
  function update(next: Partial<Draft>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    try {
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      setError(
        "This draft could not be saved. Free some browser storage before continuing.",
      );
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    setReading(true);
    setError("");
    let url = "";
    try {
      if (
        !/^image\/(jpeg|png|webp)$/.test(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Choose a JPEG, PNG, or WebP photo under 5 MB.");
      url = URL.createObjectURL(file);
      const img = new window.Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 720 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo processing is unavailable.");
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      update({ image: canvas.toDataURL("image/jpeg", 0.76) });
      notify("Photo added");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (url) URL.revokeObjectURL(url);
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function submit() {
    if (!w || busy) return;
    setBusy(true);
    setError("");
    try {
      const p = await enterpriseService.createProduct(w, draft);
      const op = await enterpriseService.submit({
        requestKey: requestKey.current,
        workspace: w,
        action: "register",
        productIds: [p.id],
      });
      localStorage.removeItem(key);
      await refresh();
      navigate(`/operations/${op.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      await refresh();
    }
  }
  return (
    <main className="page">
      <PageTitle
        back
        title="A new beginning"
        subtitle="Register one physical item"
      />
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="photo-upload">
          {draft.image ? (
            <>
              <img src={draft.image} alt="Product preview" />
              <button
                type="button"
                className="circle"
                aria-label="Remove product photo"
                onClick={() => update({ image: undefined })}
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={reading}
            >
              <ImagePlus size={28} />
              <strong>
                {reading ? "Preparing photo…" : "Add a product photo"}
              </strong>
              <small>Optional · JPEG, PNG, or WebP</small>
            </button>
          )}
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Product photo"
            onChange={(e) => void photo(e.target.files?.[0])}
          />
        </div>
        <label htmlFor="product-name">Product name</label>
        <input
          id="product-name"
          maxLength={50}
          required
          placeholder="e.g. Daily mineral complex"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <label htmlFor="brand">Brand</label>
        <input
          id="brand"
          maxLength={50}
          required
          placeholder="Brand or manufacturer"
          value={draft.brand}
          onChange={(e) => update({ brand: e.target.value })}
        />
        <label htmlFor="description">
          Description <span className="optional">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={3}
          maxLength={1000}
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Details that help identify this item"
        />
        <label htmlFor="packaging">Packaging</label>
        <select
          id="packaging"
          value={draft.kind}
          onChange={(e) => update({ kind: e.target.value as Draft["kind"] })}
        >
          <option value="carton">Box / carton</option>
          <option value="bottle">Bottle</option>
        </select>
        <div className="serial-card">
          <small>GENERATED SERIAL · ONE PHYSICAL ITEM</small>
          <code>{draft.id}</code>
          <p>
            {f.name} · {f.location}
          </p>
        </div>
        <p className="support">
          Review the name, brand, and serial before registering. A confirmed
          product’s on-chain identity cannot be edited. Dispatch is a separate
          next step.
        </p>
        <ErrorNote>{error}</ErrorNote>
        <LocationPolicy address={f.location} />
        <p className="simulation-note">
          {isLive ? 'Creates a database record and submits registration through your integrated wallet on Sepolia.' : 'Demo registration · saved locally. No live product is created.'}
        </p>
        <Primary
          className="full"
          busy={busy}
          disabled={
            reading ||
            !draft.name.trim() ||
            !draft.brand.trim() ||
            data.scenario === "offline" ||
            !navigator.onLine ||
            f.status !== "active"
          }
        >
          {isLive ? 'Register product' : 'Register demo product'}
          <ArrowRight size={18} />
        </Primary>
      </form>
    </main>
  );
}
