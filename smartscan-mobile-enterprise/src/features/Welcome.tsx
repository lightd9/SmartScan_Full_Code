import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Factory,
  ShieldCheck,
  Store,
  Truck,
  Check,
} from "lucide-react";
import { useSnapshot, useWorkspace } from "../app/context";
import { BrandMark, ErrorNote, Primary } from "../design/ui";
import { type Role, roleNames } from "../domain/types";
import { enterpriseService } from "../services";

const options = [
  {
    role: "supplier" as Role,
    icon: Truck,
    copy: "Receive, hold, and move products.",
  },
  {
    role: "manufacturer" as Role,
    icon: Factory,
    copy: "Create the product’s first chapter.",
  },
  {
    role: "retailer" as Role,
    icon: Store,
    copy: "From your shelf to their hands.",
  },
  {
    role: "admin" as Role,
    icon: ShieldCheck,
    copy: "Keep every business connected.",
  },
];
export default function Welcome() {
  const { data, error, refetch } = useSnapshot();
  const { setWorkspace, workspace } = useWorkspace();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(workspace?.role || "supplier");
  const [failure, setFailure] = useState("");
  function enter() {
    const account = data?.accounts.find((a) => a.role === role);
    const facility = data?.facilities.find((f) => f.accountId === account?.id);
    if (!account || !facility) return;
    setWorkspace({ role, accountId: account.id, facilityId: facility.id });
    navigate("/", { replace: true });
  }
  return (
    <main className="welcome">
      <div className="welcome-brand">
        <BrandMark />
        <span>
          SmartScan<span>enterprise</span>
        </span>
      </div>
      <span className="eyebrow">CONNECTED AT EVERY STEP</span>
      <h1>
        Every handover,
        <br />
        accounted for.
      </h1>
      <p className="welcome-copy">
        One shared story. A workspace for your part in it.
      </p>
      <div className="role-options">
        {options.map(({ role: r, icon: Icon, copy }) => (
          <button
            key={r}
            className={`role-option ${role === r ? "selected" : ""}`}
            onClick={() => setRole(r)}
            aria-pressed={role === r}
          >
            <span className="row-icon">
              <Icon size={23} />
            </span>
            <span>
              <strong>{roleNames[r]}</strong>
              <small>{copy}</small>
            </span>
            {role === r ? <Check size={18} /> : <ArrowRight size={17} />}
          </button>
        ))}
      </div>
      <ErrorNote>{failure || error?.message}</ErrorNote>
      <Primary disabled={!data} onClick={enter}>
        Explore {roleNames[role].toLowerCase()} workspace
        <ArrowRight size={18} />
      </Primary>
      <p className="demo-explanation">
        <strong>Interactive demo</strong>Sample businesses and products. Changes
        stay on this device; no live accounts, payments, or blockchain
        transactions.
      </p>
      {error && (
        <button
          className="text-button"
          onClick={async () => {
            try {
              await enterpriseService.reset("normal");
              await refetch();
              setFailure("");
            } catch (e) {
              setFailure((e as Error).message);
            }
          }}
        >
          Reset saved demo
        </button>
      )}
    </main>
  );
}
