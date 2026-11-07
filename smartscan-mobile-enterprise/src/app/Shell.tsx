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
} from "lucide-react";
import { useBusiness, useRefresh } from "./context";
import { Badge, BrandMark, ErrorNote, Loading, Sheet } from "../design/ui";
import { roleNames } from "../domain/types";

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
  const { workspace, data, error, facility, account, setWorkspace, notice } =
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
        <button className="primary" onClick={() => navigate("/welcome")}>
          Return to demo setup
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
            Demo workspace
          </span>
          <button onClick={() => navigate("/welcome")}>
            {roleNames[workspace.role]}
            <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="workspace-bar">
          <span className="wordmark">
            SmartScan<span>enterprise</span>
          </span>
          <button
            className="facility-button"
            onClick={() => setSwitching(true)}
            aria-label="Change active facility"
          >
            <Building2 size={15} />
            <span>{facility.code}</span>
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
        {facility.status !== "active" && (
          <div className="offline-banner" role="status">
            {facility.status === "revoked"
              ? "Facility revoked"
              : "Awaiting facility approval"}{" "}
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
      <div className={`toast ${notice ? "visible" : ""}`} role="status">
        {notice}
      </div>
      {switching && (
        <Sheet title="Your active facility" onClose={() => setSwitching(false)}>
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
