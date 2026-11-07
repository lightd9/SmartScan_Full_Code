import { useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Factory,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { useBusiness, useRefresh } from "../app/context";
import { enterpriseService, isLive } from "../services";
import { type Facility, type Role, roleNames } from "../domain/types";
import {
  ActionRow,
  Badge,
  Empty,
  ErrorNote,
  PageTitle,
  Primary,
  SectionTitle,
  Sheet,
} from "../design/ui";

export default function Accounts() {
  const { id } = useParams();
  const { data, workspace: w, notify } = useBusiness();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const [provision, setProvision] = useState(false);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [business, setBusiness] = useState({
    password: '',
    name: "",
    username: "",
    role: "manufacturer" as Role,
  });
  const [facility, setFacility] = useState({
    name: "",
    code: "",
    location: "",
  });
  if (!data || !w) return null;
  if (w.role !== "admin") return <Navigate to="/" replace />;
  const account = data.accounts.find((a) => a.id === id);
  const pendingOnly = params.get("pending") === "1";
  const filtered = data.accounts.filter(
    (a) =>
      a.role !== "admin" &&
      `${a.name} ${a.username}`.toLowerCase().includes(search.toLowerCase()) &&
      (!pendingOnly ||
        data.facilities.some(
          (f) => f.accountId === a.id && f.status === "pending",
        )),
  );
  const roleIcon = (role: Role) =>
    role === "manufacturer" ? (
      <Factory size={23} />
    ) : role === "supplier" ? (
      <Truck size={23} />
    ) : (
      <Store size={23} />
    );
  const open = (which: "create" | "provision") => {
    setError("");
    which === "create" ? setCreate(true) : setProvision(true);
  };
  async function save(which: "create" | "provision") {
    if (!w || busy) return;
    setBusy(true);
    setError("");
    try {
      if (which === "create") {
        const a = await enterpriseService.createAccount(w, business);
        setCreate(false);
        setBusiness({ name: "", username: "", password: '', role: "manufacturer" });
        navigate(`/accounts/${a.id}`);
        notify("Business added");
      } else {
        await enterpriseService.createFacility(w, {
          ...facility,
          accountId: id!,
        });
        setProvision(false);
        setFacility({ name: "", code: "", location: "" });
        notify("Facility added");
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus() {
    if (!w || !selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await enterpriseService.setFacilityStatus(
        w,
        selected.id,
        selected.status === "pending" ? "active" : "revoked",
      );
      await refresh();
      notify(
        selected.status === "pending"
          ? "Facility approved"
          : "Facility revoked",
      );
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <PageTitle
        back={Boolean(id)}
        title={id ? "Business details" : "Businesses"}
        subtitle={
          id
            ? "Account and facility readiness"
            : "The people behind the products"
        }
        action={
          !id ? (
            <button
              className="circle raised"
              aria-label="Add business"
              onClick={() => open("create")}
            >
              <Plus size={22} />
            </button>
          ) : undefined
        }
      />
      {id ? (
        account ? (
          <>
            <section className="business-card">
              <span className="empty-icon">{roleIcon(account.role)}</span>
              <Badge>{roleNames[account.role]}</Badge>
              <h2>{account.name}</h2>
              <p>@{account.username}</p>
              <small>{isLive ? 'Registered business account' : 'Demo business account'}</small>
            </section>
            <SectionTitle title="Facilities">
              <button className="text-button" onClick={() => open("provision")}>
                <Plus size={15} />
                Add facility
              </button>
            </SectionTitle>
            <div className="choice-list">
              {data.facilities
                .filter((f) => f.accountId === account.id)
                .map((f) => (
                  <button
                    className="choice facility-card"
                    key={f.id}
                    onClick={() => {
                      setError("");
                      setSelected(f);
                    }}
                  >
                    <span className="row-icon">
                      <Building2 size={23} />
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
                        {f.status === "pending"
                          ? "Approval needed"
                          : f.status === "active"
                            ? "Ready to operate"
                            : "Revoked"}
                      </Badge>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
            </div>
            {!data.facilities.some((f) => f.accountId === account.id) && (
              <Empty title="Add a place to work">
                Provision a facility, then approve it before this business can
                record operations.
              </Empty>
            )}
          </>
        ) : (
          <Empty title="Business not found">
            Return to the business directory.
          </Empty>
        )
      ) : (
        <>
          <label className="search">
            <Search size={19} />
            <input
              aria-label="Search businesses"
              placeholder="Search businesses or usernames"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="filter-strip">
            <button
              className={!pendingOnly ? "selected" : ""}
              onClick={() => setParams({})}
            >
              All businesses
            </button>
            <button
              className={pendingOnly ? "selected" : ""}
              onClick={() => setParams({ pending: "1" })}
            >
              Need approval
            </button>
          </div>
          <div className="list-caption">
            <span>{filtered.length} businesses</span>
            <span>{isLive ? 'SmartScan network' : 'Demo network'}</span>
          </div>
          <div className="surface">
            {filtered.map((a) => (
              <ActionRow
                key={a.id}
                icon={roleIcon(a.role)}
                title={a.name}
                detail={`${roleNames[a.role]} · ${data.facilities.filter((f) => f.accountId === a.id).length} facilities`}
                onClick={() => navigate(`/accounts/${a.id}`)}
              />
            ))}
          </div>
          {!filtered.length && (
            <Empty title="No matching businesses">
              Try another search or view all businesses.
            </Empty>
          )}
        </>
      )}
      {create && (
        <Sheet title="Add a business" onClose={() => setCreate(false)}>
          <p className="support">
            {isLive ? 'Create a business account and its integrated wallet. The business will use this username and password to sign in.' : 'Create a sample account, then add and approve its operating facilities.'}
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save("create");
            }}
          >
            <label htmlFor="business-name">Business name</label>
            <input
              id="business-name"
              data-autofocus
              required
              maxLength={100}
              value={business.name}
              onChange={(e) =>
                setBusiness({ ...business, name: e.target.value })
              }
            />
            <label htmlFor="username">Username</label>
            <input
              id="username"
              required
              pattern="[a-zA-Z0-9._\-]{3,50}"
              autoCapitalize="off"
              value={business.username}
              onChange={(e) =>
                setBusiness({ ...business, username: e.target.value })
              }
            />
            <label htmlFor="business-role">Business role</label>
            <select
              id="business-role"
              value={business.role}
              onChange={(e) =>
                setBusiness({ ...business, role: e.target.value as Role })
              }
            >
              <option value="manufacturer">Manufacturer</option>
              <option value="supplier">Supplier</option>
              <option value="retailer">Retailer</option>
            </select>
            {isLive && <>
              <label htmlFor="business-password">Initial password</label>
              <input id="business-password" type="password" autoComplete="new-password" required minLength={12} maxLength={200}
                value={business.password} onChange={e => setBusiness({ ...business, password: e.target.value })} />
            </>}
            <ErrorNote>{error}</ErrorNote>
            <Primary busy={busy}>
              {isLive ? 'Create business' : 'Create demo business'}
              <Plus size={17} />
            </Primary>
          </form>
        </Sheet>
      )}
      {provision && account && (
        <Sheet
          title="Add an operating facility"
          onClose={() => setProvision(false)}
        >
          <p className="support">
            This facility will belong to {account.name} and use its{" "}
            {roleNames[account.role].toLowerCase()} role.
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void save("provision");
            }}
          >
            <label htmlFor="facility-name">Facility name</label>
            <input
              id="facility-name"
              data-autofocus
              required
              maxLength={100}
              value={facility.name}
              onChange={(e) =>
                setFacility({ ...facility, name: e.target.value })
              }
            />
            <label htmlFor="facility-code">Facility code</label>
            <input
              id="facility-code"
              required
              maxLength={30}
              placeholder="e.g. LAG-DOCK-02"
              value={facility.code}
              onChange={(e) =>
                setFacility({ ...facility, code: e.target.value })
              }
            />
            <label htmlFor="facility-location">Recorded location</label>
            <input
              id="facility-location"
              required
              maxLength={200}
              value={facility.location}
              onChange={(e) =>
                setFacility({ ...facility, location: e.target.value })
              }
            />
            <ErrorNote>{error}</ErrorNote>
            <Primary busy={busy}>
              Create facility for review
              <ArrowRight size={17} />
            </Primary>
          </form>
        </Sheet>
      )}
      {selected && (
        <Sheet title={selected.name} onClose={() => setSelected(null)}>
          <Badge
            tone={
              selected.status === "active"
                ? "blue"
                : selected.status === "revoked"
                  ? "red"
                  : "amber"
            }
          >
            {selected.status === "pending"
              ? "Awaiting approval"
              : selected.status}
          </Badge>
          <div className="detail-pairs">
            <div>
              <small>Facility code</small>
              <strong>{selected.code}</strong>
            </div>
            <div>
              <small>Recorded location</small>
              <strong>{selected.location}</strong>
            </div>
          </div>
          <p className="support">
            {selected.status === "pending"
              ? "Approval allows this facility to perform actions within its assigned business role."
              : selected.status === "active"
                ? "Revoking this facility blocks further operations. Its recorded product history stays available."
                : "This facility has been revoked. Its history remains available; provision a replacement for future operations."}
          </p>
          <p className="simulation-note">
            {isLive ? 'This changes the facility’s operational wallet permissions.' : 'Demo administration · no live wallet or funding changes.'}
          </p>
          <ErrorNote>{error}</ErrorNote>
          {selected.status !== "revoked" && (
            <Primary busy={busy} onClick={() => void changeStatus()}>
              {selected.status === "pending"
                ? isLive ? 'Approve facility' : "Approve demo facility"
                : isLive ? 'Revoke facility' : "Revoke demo facility"}
              <ShieldCheck size={17} />
            </Primary>
          )}
        </Sheet>
      )}
    </main>
  );
}
