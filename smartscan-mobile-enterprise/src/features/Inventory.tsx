import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useBusiness } from "../app/context";
import { Empty, PageTitle, ProductRow, Sheet } from "../design/ui";
import { belongsToView } from "../domain/rules";
import type { Filter } from "../domain/types";

const labels: Record<Filter, string> = {
  all: "All items",
  incoming: "Incoming",
  held: "In custody",
  outgoing: "Outgoing",
  pending: "Registrations",
  sold: "Sold",
  recalled: "Recalled",
};
export default function Inventory() {
  const { data, workspace: w, facility: f } = useBusiness();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(20);
  const requested = params.get("filter") || "all";
  const filter = (requested in labels ? requested : "all") as Filter;
  const search = params.get("q") || "";
  const products = useMemo(
    () =>
      data && w && f
        ? data.products.filter(
            (p) =>
              belongsToView(p, filter, f, w) &&
              `${p.name} ${p.brand} ${p.id}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
        : [],
    [data, w, f, filter, search],
  );
  if (!data || !w || !f) return null;
  const tabs: Filter[] =
    w.role === "manufacturer"
      ? ["all", "held", "outgoing", "pending", "recalled"]
      : w.role === "retailer"
        ? ["all", "held", "incoming", "sold", "recalled"]
        : ["all", "held", "incoming", "outgoing", "recalled"];
  const setFilter = (value: Filter) => {
    setParams(
      (prev) => {
        prev.set("filter", value);
        return prev;
      },
      { replace: true },
    );
    setLimit(20);
  };
  return (
    <main className="page inventory-page">
      <PageTitle
        title={w.role === "manufacturer" ? "Your products" : "Inventory"}
        subtitle={f.name}
        action={
          w.role === "manufacturer" ? (
            <button
              className="circle raised"
              aria-label="Register a product"
              onClick={() => navigate("/register")}
            >
              <Plus size={21} />
            </button>
          ) : (
            <button
              className="circle raised"
              aria-label="Filter inventory"
              onClick={() => setShowFilters(true)}
            >
              <SlidersHorizontal size={21} />
            </button>
          )
        }
      />
      <label className="search">
        <Search size={19} />
        <input
          aria-label="Search products"
          placeholder="Name, brand, or serial number"
          value={search}
          onChange={(e) => {
            setParams(
              (prev) => {
                e.target.value
                  ? prev.set("q", e.target.value)
                  : prev.delete("q");
                return prev;
              },
              { replace: true },
            );
            setLimit(20);
          }}
        />
      </label>
      <div className="filter-strip" aria-label="Inventory filters">
        {tabs.map((t) => (
          <button
            key={t}
            aria-pressed={filter === t}
            className={filter === t ? "selected" : ""}
            onClick={() => setFilter(t)}
          >
            {labels[t]}
          </button>
        ))}
      </div>
      <div className="list-caption">
        <span>
          {products.length} item{products.length === 1 ? "" : "s"}
        </span>
        <span>At this facility</span>
      </div>
      <div className="product-list">
        {products.slice(0, limit).map((p) => (
          <ProductRow
            product={p}
            key={p.id}
            onClick={() => navigate(`/products/${p.id}`)}
          />
        ))}
      </div>
      {!products.length && (
        <Empty title={search ? "No matching products" : "Nothing here yet"}>
          {search
            ? "Try a product name or its serial number."
            : "Items appear here as your facility registers, receives, or moves them."}
        </Empty>
      )}
      {products.length > limit && (
        <button className="secondary full" onClick={() => setLimit(limit + 20)}>
          Show more items
        </button>
      )}
      {showFilters && (
        <Sheet title="Show inventory" onClose={() => setShowFilters(false)}>
          <div className="choice-list">
            {tabs.map((t) => (
              <button
                key={t}
                className={`choice ${t === filter ? "selected" : ""}`}
                onClick={() => {
                  setFilter(t);
                  setShowFilters(false);
                }}
              >
                {labels[t]}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </main>
  );
}
