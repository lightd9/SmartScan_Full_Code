import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  Info,
  LogOut,
  RefreshCw,
  Smartphone,
  Volume2,
} from "lucide-react";
import { useBusiness, useRefresh } from "../app/context";
import { enterpriseService, isLive } from "../services";
import { signOut } from '../services/session';
import { type Scenario, roleNames } from "../domain/types";
import {
  ActionRow,
  Badge,
  BrandMark,
  ErrorNote,
  PageTitle,
  Primary,
  SectionTitle,
  Sheet,
} from "../design/ui";
import { preferences } from "../platform/feedback";

export default function More() {
  const {
    data,
    workspace: w,
    facility: f,
    account,
    setWorkspace,
    notify,
  } = useBusiness();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(preferences);
  const [modal, setModal] = useState<
    "about" | "profile" | "reset" | "logout" | null
  >(null);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [error, setError] = useState("");
  if (!data || !w || !f || !account) return null;
  function toggle(key: "haptics" | "sound") {
    const next = { ...prefs, [key]: !prefs[key] };
    try {
      localStorage.setItem(
        "smartscan-enterprise-feedback",
        JSON.stringify(next),
      );
      setPrefs(next);
      notify("Preference saved");
    } catch {
      notify("Preferences could not be saved on this device.");
    }
  }
  return (
    <main className="page">
      <PageTitle title="Your workspace, your way" />
      <section className="more-intro">
        <BrandMark />
        <h2>
          A little more
          <br />
          peace of mind.
        </h2>
        <p>
          {account.name}
          <br />
          {roleNames[w.role]} · {f.code}
        </p>
        <Badge>{isLive ? 'Connected workspace' : 'Demo workspace'}</Badge>
      </section>
      <SectionTitle title="Your account" />
      <div className="surface">
        <ActionRow
          icon={<Building2 size={21} />}
          title="Business & facility"
          detail={f.name}
          onClick={() => setModal("profile")}
        />
        <ActionRow
          icon={<Clock3 size={21} />}
          title="Operation history"
          detail="Completed work and actions in progress"
          onClick={() => navigate("/activity")}
        />
      </div>
      <SectionTitle title="Make it yours" />
      <div className="surface">
        <ActionRow
          icon={<Smartphone size={21} />}
          title="Haptic feedback"
          detail="A gentle tap on supported native devices"
          end={
            <button
              className={`switch ${prefs.haptics ? "on" : ""}`}
              role="switch"
              aria-checked={prefs.haptics}
              aria-label="Haptic feedback"
              onClick={() => toggle("haptics")}
            >
              <i />
            </button>
          }
        />
        <ActionRow
          icon={<Volume2 size={21} />}
          title="Scan sounds"
          detail="Different tones for capture and exceptions"
          end={
            <button
              className={`switch ${prefs.sound ? "on" : ""}`}
              role="switch"
              aria-checked={prefs.sound}
              aria-label="Scan sounds"
              onClick={() => toggle("sound")}
            >
              <i />
            </button>
          }
        />
      </div>
      <SectionTitle title={isLive ? 'About SmartScan' : 'Explore the demo'} />
      <div className="surface">
        {!isLive && <><ActionRow
          icon={<ArrowUpRight size={21} />}
          title="Switch demo role"
          detail="Explore Admin, Manufacturer, Supplier, or Retailer"
          onClick={() => navigate("/welcome")}
        />
        <ActionRow
          icon={<RefreshCw size={21} />}
          title="Demo scenarios"
          detail="Normal flow, partial completion, empty, or offline"
          onClick={() => {
            setScenario(data.scenario);
            setError("");
            setModal("reset");
          }}
        /></>}
        <ActionRow
          icon={<Info size={21} />}
          title="How SmartScan works"
          detail="Identity, custody, and the next handover"
          onClick={() => setModal("about")}
        />
      </div>
      <button className="sign-out" onClick={() => setModal("logout")}>
        <LogOut size={17} />
        {isLive ? 'Sign out' : 'Leave demo workspace'}
      </button>
      <p className="simulation-note">
        {isLive ? 'SmartScan · Sepolia test network' : 'SmartScan Enterprise · Interface preview 0.1'}
      </p>
      {modal === "profile" && (
        <Sheet title="Business & facility" onClose={() => setModal(null)}>
          <div className="profile-details">
            <Badge>{roleNames[w.role]}</Badge>
            <h3>{account.name}</h3>
            <p>@{account.username}</p>
            <dl>
              <dt>Active facility</dt>
              <dd>{f.name}</dd>
              <dt>Facility code</dt>
              <dd>{f.code}</dd>
              <dt>Location</dt>
              <dd>{f.location}</dd>
              <dt>Readiness</dt>
              <dd>{f.status === "active" ? "Ready to operate" : f.status}</dd>
            </dl>
          </div>
          <p className="support">
            Use the facility selector at the top of the app to change your
            operating location.
          </p>
        </Sheet>
      )}
      {modal === "about" && (
        <Sheet
          title="Every handover has a story"
          onClose={() => setModal(null)}
        >
          <div className="prose">
            <h3>One identity per item</h3>
            <p>
              A manufacturer registers a serial for each physical item. Its QR
              points to that item’s product passport.
            </p>
            <h3>Custody follows the handover</h3>
            <p>
              A sender dispatches an item. The eligible recipient confirms that
              it arrived. Only a retailer holding a received item can record its
              sale.
            </p>
            <h3>Clear exceptions</h3>
            <p>
              Recalled, unregistered, and already sold items need different
              handling. A scan cannot prove physical authenticity on its own.
            </p>
            <h3>{isLive ? 'Connected to your business' : 'This is an interactive demo'}</h3>
            <p>
              {isLive ? 'Records are stored in the shared SmartScan database. Facility actions are signed on the Sepolia test network. A registered code alone does not prove the contents of a physical product.' : 'Records stay on this device. No live identities, funds, or blockchain transactions are involved.'}
            </p>
          </div>
        </Sheet>
      )}
      {modal === "reset" && (
        <Sheet title="Choose a demo scenario" onClose={() => setModal(null)}>
          <p className="support">
            Loading a scenario replaces demo products, scan sessions,
            operations, and businesses on this device. It does not affect the
            consumer app.
          </p>
          <div className="choice-list">
            {(
              [
                [
                  "normal",
                  "Everyday operations",
                  "Incoming deliveries, stock, and a recall.",
                ],
                [
                  "partial",
                  "Partial completion",
                  "One incoming item fails once, then can be retried.",
                ],
                [
                  "empty",
                  "A fresh workspace",
                  "Start with no sample products or operations.",
                ],
                [
                  "offline",
                  "Offline handling",
                  "Capture codes and keep drafts; recording is blocked.",
                ],
              ] as const
            ).map(([value, title, description]) => (
              <button
                key={value}
                className={`choice ${scenario === value ? "selected" : ""}`}
                aria-pressed={scenario === value}
                onClick={() => setScenario(value)}
              >
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </div>
          <ErrorNote>{error}</ErrorNote>
          <Primary
            onClick={async () => {
              try {
                await enterpriseService.reset(scenario);
                await refresh();
                setModal(null);
                notify("Demo scenario loaded.");
                navigate("/");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Replace demo data
            <RefreshCw size={17} />
          </Primary>
        </Sheet>
      )}
      {modal === "logout" && (
        <Sheet title="Leave this workspace?" onClose={() => setModal(null)}>
          <p className="support">
            {isLive ? 'Your recorded operations remain in SmartScan. You will need your username and password to return.' : 'Your demo records and scan sessions remain on this device.'}
          </p>
          <Primary
            onClick={() => {
              if (isLive) signOut();
              setWorkspace(null);
              navigate("/welcome", { replace: true });
            }}
          >
            {isLive ? 'Sign out' : 'Leave demo workspace'}
            <LogOut size={17} />
          </Primary>
        </Sheet>
      )}
    </main>
  );
}
