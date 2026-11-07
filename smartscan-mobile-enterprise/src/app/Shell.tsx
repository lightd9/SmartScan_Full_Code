import { useLayoutEffect, useRef, useState } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Building2,
  ChevronDown,
  Home,
  Layers3,
  LayoutGrid,
  ScanLine,
  ShieldCheck,
  Users,
  WifiOff,
  Check,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import { useBusiness, useRefresh } from "./context";
import { Badge, BrandMark, ErrorNote, Loading, Sheet } from "../design/ui";
import { roleNames } from "../domain/types";
import { isLive } from '../services';
import { signOut } from '../services/session';

const scrollPositions = new Map<string, number>();
function Screen() {
  const location = useLocation();
  const view = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = view.current;
    if (!element) return;
    element.scrollTop = scrollPositions.get(location.key) || 0;
    return () => {
      scrollPositions.set(location.key, element.scrollTop);
    };
  }, [location.key]);
  return (
    <div className="screen" ref={view}>
      <Outlet />
    </div>
  );
}

export default function Shell() {
  const { workspace, data, error, facility, account, setWorkspace, notice, noticeId } =
    useBusiness();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const refresh = useRefresh();
  if (!workspace) return <Navigate to="/welcome" replace />;
  if (error)
    return (
      <main className="welcome">
        <BrandMark />
        <h1>Let’s restore your workspace.</h1>
        <ErrorNote>{error.message}</ErrorNote>
        <button className="primary" onClick={() => void refresh()}>
          Reconnect
        </button>
      </main>
    );
  if (!data) return <Loading />;
  if (!facility || !account) return <Navigate to="/welcome" replace />;
  const admin = workspace.role === "admin";
  const nav = admin
    ? [
        { to: "/", label: "Overview", icon: Home },
        { to: "/accounts", label: "Accounts", icon: Users },
        { to: "/operations", label: "Operations", icon: ShieldCheck },
        { to: "/more", label: "More", icon: LayoutGrid },
      ]
    : [
        { to: "/", label: "Home", icon: Home },
        {
          to: "/inventory",
          label: workspace.role === "manufacturer" ? "Products" : "Inventory",
          icon: Layers3,
        },
        { to: "/scan", label: "Scan", icon: ScanLine },
        { to: "/more", label: "More", icon: LayoutGrid },
      ];
  const offline = data.scenario === "offline" || !navigator.onLine;
  return (
    <>
      <div className="shell-body">
        <div className="demo-strip">
          <span>
            <i />
            {isLive ? data.network?.name || 'Connected workspace' : 'Demo workspace'}
          </span>
          <button onClick={() => { if (isLive) signOut(); navigate("/welcome"); }}>
            {roleNames[workspace.role]}
            <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="workspace-bar">
          <span className="wordmark">
            SmartScan
          </span>
          <button
            className="facility-button"
            onClick={() => setSwitching(true)}
            aria-label="View wallet and change active facility"
          >
            <Wallet size={15} />
            <span>{facility.wallet ? `${facility.wallet.slice(0, 6)}…${facility.wallet.slice(-4)}` : "Wallet pending"}</span>
            <ChevronDown size={14} />
          </button>
        </div>
        {offline && (
          <div className="offline-banner" role="status">
            <WifiOff size={14} />
            {data.scenario === "offline" ? "Offline demo" : "You’re offline"} ·
            drafts stay on this device
          </div>
        )}
        {data.warnings?.map(warning => <div key={warning} className="offline-banner" role="status">{warning}</div>)}
        {facility.status !== "active" && (
          <div className="offline-banner" role="status">
            {facility.status === "revoked"
              ? "Facility revoked"
              : facility.status === 'suspended' ? 'Facility suspended' : "Awaiting facility approval"}{" "}
            · actions unavailable
          </div>
        )}
        <Screen key={location.pathname} />
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">
              <Icon size={22} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={`toast ${notice ? "visible" : ""}`} role="status" aria-atomic="true">
        <span key={noticeId}>{notice}</span>
      </div>
      {switching && (
        <Sheet title="Integrated wallet" onClose={() => setSwitching(false)}>
          <div className="wallet-summary">
            <Badge>{isLive ? data.network?.name || 'Integrated wallet' : 'Demo wallet'}</Badge>
            <strong>{facility.name}</strong>
            <code>{facility.wallet || (workspace.role === 'admin' ? 'Network administration' : 'Awaiting wallet provisioning')}</code>
            <p className="support">{isLive ? 'Your facility wallet signs actions on the server. Wallet keys stay off this device.' : 'This is a sample wallet. Demo actions do not send blockchain transactions.'}</p>
            {isLive && facility.wallet && <>
              <p>Gas balance: {facility.balanceEth == null ? 'Unavailable' : `${Number(facility.balanceEth).toFixed(6)} test ETH`}</p>
              <p>Blockchain role: {facility.chainRole || 'Could not be checked'}</p>
              {facility.balanceEth !== null && Number(facility.balanceEth) < 0.0002 && <p className="support">Gas funding is needed. SmartScan will request a treasury top-up when you record an action.</p>}
            </>}
          </div>
          <p className="support">
            Your inventory and actions belong to this facility. Scan sessions
            are saved separately for each location.
          </p>
          <div className="choice-list">
            {data.facilities
              .filter((f) => f.accountId === account.id)
              .map((f) => (
                <button
                  className={`choice ${f.id === facility.id ? "selected" : ""}`}
                  key={f.id}
                  onClick={() => {
                    setWorkspace({ ...workspace, facilityId: f.id });
                    setSwitching(false);
                    navigate("/");
                    void refresh();
                  }}
                >
                  <span className="row-icon">
                    <Building2 size={22} />
                  </span>
                  <span>
                    <strong>{f.name}</strong>
                    <small>
                      {f.code} · {f.location}
                    </small>
                    <Badge
                      tone={
                        f.status === "active"
                          ? "blue"
                          : f.status === "revoked"
                            ? "red"
                            : "amber"
                      }
                    >
                      {f.status === "pending" ? "Approval needed" : f.status}
                    </Badge>
                  </span>
                  {f.id === facility.id && <Check size={18} />}
                </button>
              ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
