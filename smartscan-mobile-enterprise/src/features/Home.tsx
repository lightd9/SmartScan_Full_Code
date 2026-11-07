import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Box,
  ChevronRight,
  Clock3,
  Factory,
  PackageCheck,
  Plus,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { useBusiness } from "../app/context";
import {
  ActionRow,
  Badge,
  Empty,
  ProductRow,
  SectionTitle,
  timeLabel,
} from "../design/ui";
import { actionNames, type Filter } from "../domain/types";
import { belongsToView } from "../domain/rules";
import { isLive } from '../services';

export default function Home() {
  const { data, workspace: w, facility: f, account } = useBusiness();
  const navigate = useNavigate();
  if (!data || !w || !f || !account) return null;
  const admin = w.role === "admin";
  const maker = w.role === "manufacturer";
  const retail = w.role === "retailer";
  const count = (filter: Filter) =>
    data.products.filter((p) => belongsToView(p, filter, f, w)).length;
  const tasks = data.products.filter((p) =>
    belongsToView(p, maker ? "pending" : "incoming", f, w),
  );
  const operations = data.operations.filter(
    (o) => admin || o.facilityId === f.id,
  );
  const active = operations.filter((o) =>
    o.items.some((i) => i.status === "submitted" || i.status === "failed"),
  );
  const Icon = admin ? ShieldCheck : maker ? Factory : retail ? Store : Truck;
  const heroTitle = admin ? (
    <>
      A clear view.
      <br />A stronger network.
    </>
  ) : maker ? (
    <>
      Good products.
      <br />
      Great beginnings.
    </>
  ) : retail ? (
    <>
      Ready for their
      <br />
      next chapter.
    </>
  ) : (
    <>
      Keep good things
      <br />
      moving.
    </>
  );
  const action = admin
    ? () => navigate("/accounts")
    : maker
      ? () => navigate("/register")
      : () => navigate(`/scan?task=${retail ? "sell" : "receive"}`);
  const activity = operations.slice(0, 3);
  return (
    <main className="page home-page">
      <header className="home-heading">
        <div>
          <p className="eyebrow">
            {admin ? "YOUR NETWORK" : account.name.toUpperCase()}
          </p>
          <h1>{admin ? "Overview" : "Your workspace"}</h1>
        </div>
        <span className="circle raised decorative">
          <Icon size={23} />
        </span>
      </header>
      {isLive && <button className="secondary full spaced" onClick={()=>navigate('/handovers')}>Handover approvals</button>}
      {isLive && admin && <button className="secondary full spaced" onClick={()=>navigate('/reports')}>Consumer reports</button>}
      <div className="home-summary">
      <section className="hero-card">
        <div className="hero-orbit" aria-hidden="true">
          <Icon />
        </div>
        <Badge>{admin ? "Governance & oversight" : f.name}</Badge>
        <h2>{heroTitle}</h2>
        <p>
          {admin
            ? "Businesses, facilities, and the work that needs you."
            : maker
              ? "Give every item a traceable start."
              : retail
                ? "Receive with care. Sell with confidence."
                : "From arrival to departure, every item has a place."}
        </p>
        <button className="hero-action" onClick={action}>
          {admin
            ? "Manage businesses"
            : maker
              ? "Register a product"
              : retail
                ? "Record a sale"
                : "Receive a delivery"}
          {maker ? <Plus size={19} /> : <ArrowRight size={19} />}
        </button>
      </section>
      <div className="home-metrics">
      <div className="metric-grid">
        {(admin
          ? [
              {
                label: "Businesses",
                value: data.accounts.filter((a) => a.role !== "admin").length,
                icon: Box,
                path: "/accounts",
              },
              {
                label: "Need approval",
                value: data.facilities.filter((f) => f.status === "pending")
                  .length,
                icon: Clock3,
                path: "/accounts?pending=1",
              },
              {
                label: "Scan alerts",
                value: data.alerts.length,
                icon: ShieldCheck,
                path: "/operations?view=alerts",
              },
            ]
          : [
              {
                label: maker ? "At your facility" : "In custody",
                value: count("held"),
                icon: PackageCheck,
                path: "/inventory?filter=held",
              },
              {
                label: maker ? "Registrations" : "Incoming",
                value: count(maker ? "pending" : "incoming"),
                icon: ArrowDownLeft,
                path: `/inventory?filter=${maker ? "pending" : "incoming"}`,
              },
              {
                label: retail ? "Sold" : "Outgoing",
                value: count(retail ? "sold" : "outgoing"),
                icon: ArrowUpRight,
                path: `/inventory?filter=${retail ? "sold" : "outgoing"}`,
              },
            ]
        ).map(({ label, value, icon: SmallIcon, path }) => (
          <button key={label} onClick={() => navigate(path)} className="metric">
            <SmallIcon size={18} />
            <strong>{value}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {!admin && (
        <div className="quick-actions">
          <button
            onClick={() =>
              navigate(`/scan?task=${retail ? "receive" : "dispatch"}`)
            }
          >
            {retail ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            {retail ? "Receive stock" : "Dispatch items"}
          </button>
          <button onClick={() => navigate("/inventory")}>
            <Box size={18} />
            {maker ? "Your products" : "View inventory"}
          </button>
        </div>
      )}
      </div>
      </div>
      {active.length > 0 && (
        <button
          className="attention-card"
          onClick={() => navigate("/activity")}
        >
          <Clock3 size={20} />
          <span>
            <strong>
              {active.length} operation{active.length === 1 ? "" : "s"} to
              follow up
            </strong>
            <small>Check progress or review unfinished items.</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
      <SectionTitle
        title={
          admin
            ? "Needs your attention"
            : maker
              ? "Pick up where you left off"
              : "Arriving at your facility"
        }
      >
        <button
          className="text-button"
          onClick={() =>
            navigate(
              admin
                ? "/operations"
                : `/inventory?filter=${maker ? "pending" : "incoming"}`,
            )
          }
        >
          View all
          <ArrowRight size={14} />
        </button>
      </SectionTitle>
      {admin ? (
        <div className="surface">
          {data.facilities
            .filter((f) => f.status === "pending")
            .slice(0, 2)
            .map((f) => (
              <ActionRow
                key={f.id}
                icon={<Store size={21} />}
                title={f.name}
                detail="Facility approval needed"
                onClick={() => navigate(`/accounts/${f.accountId}`)}
              />
            ))}
          {data.alerts.slice(0, 1).map((a) => (
            <ActionRow
              key={a.id}
              icon={<ShieldCheck size={21} />}
              title={a.title}
              detail="Review the recorded product history"
              onClick={() => navigate("/operations?view=alerts")}
            />
          ))}
          {!data.alerts.length &&
            !data.facilities.some((f) => f.status === "pending") && (
              <p className="surface-copy">Nothing needs attention right now.</p>
            )}
        </div>
      ) : tasks.length ? (
        <div className="product-list">
          {tasks.slice(0, 2).map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onClick={() => navigate(`/products/${p.id}`)}
            />
          ))}
        </div>
      ) : (
        <Empty title={maker ? "A fresh start" : "You’re up to date"}>
          {maker
            ? "Your unfinished registrations will appear here."
            : "New deliveries for this facility will appear here."}
        </Empty>
      )}
      <SectionTitle title="Recent activity">
        <button className="text-button" onClick={() => navigate("/activity")}>
          View all
          <ArrowRight size={14} />
        </button>
      </SectionTitle>
      <div className="surface">
        {activity.length ? (
          activity.map((o) => (
            <ActionRow
              key={o.id}
              icon={<Clock3 size={20} />}
              title={`${actionNames[o.action]} · ${o.items.length} item${o.items.length === 1 ? "" : "s"}`}
              detail={timeLabel(o.createdAt)}
              onClick={() => navigate(`/operations/${o.id}`)}
            />
          ))
        ) : (
          <div className="quiet-empty">
            <Clock3 size={23} />
            <p>
              Your next move starts the story.
              <span>Completed actions and work in progress appear here.</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
