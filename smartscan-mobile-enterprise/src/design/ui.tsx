import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Package,
  ScanLine,
  ShieldCheck,
  X,
  AlertCircle,
  LoaderCircle,
  Check,
} from "lucide-react";
import { Stage, stageNames, type Product } from "../domain/types";

export function PageTitle({
  title,
  subtitle,
  back = false,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="page-title">
      {back && (
        <button
          className="circle raised"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={21} />
        </button>
      )}
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function Primary({
  children,
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`primary ${props.className || ""}`}
    >
      {busy ? <LoaderCircle className="spin" size={18} /> : null}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "amber" | "red" | "neutral" | "green";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function ProductBadge({ product: p }: { product: Product }) {
  if (p.registration !== "confirmed")
    return (
      <Badge tone="amber">
        {p.registration === "submitted"
          ? "Registering"
          : p.registration === "needs_retry"
            ? "Needs retry"
            : "Draft"}
      </Badge>
    );
  return (
    <Badge
      tone={
        p.stage === Stage.Recalled
          ? "red"
          : p.stage === Stage.Dispatched
            ? "amber"
            : p.stage === Stage.Sold
              ? "neutral"
              : "blue"
      }
    >
      {stageNames[p.stage]}
    </Badge>
  );
}
export function ProductArt({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  return (
    <div className={`product-art ${large ? "large" : ""}`} aria-hidden="true">
      {product.image ? (
        <img src={product.image} alt="" />
      ) : (
        <div className={`pack ${product.kind}`}>
          <i />
          <div>
            <span className="pack-brand">{product.brand}</span>
            <ShieldCheck />
            <span className="pack-label">
              {large ? product.name : "care, traced."}
            </span>
            <b />
          </div>
        </div>
      )}
    </div>
  );
}
export function ProductRow({
  product,
  detail,
  onClick,
  end,
}: {
  product: Product;
  detail?: string;
  onClick?: () => void;
  end?: ReactNode;
}) {
  const content = (
    <>
      <ProductArt product={product} />
      <span className="product-row-copy">
        <strong>{product.name}</strong>
        <small>{detail || `${product.brand} · …${product.id.slice(-6)}`}</small>
        <ProductBadge product={product} />
      </span>
      {end || <ChevronRight size={17} />}
    </>
  );
  return onClick ? (
    <button className="product-row" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="product-row">{content}</div>
  );
}
export function Empty({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon || <Package size={27} />}</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorNote({ children }: { children?: ReactNode }) {
  return children ? (
    <p className="error-note" role="alert">
      <AlertCircle size={17} />
      <span>{children}</span>
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      Loading your workspace…
    </div>
  );
}
export function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function ActionRow({
  icon,
  title,
  detail,
  onClick,
  end,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  onClick?: () => void;
  end?: ReactNode;
}) {
  const content = (
    <>
      <span className="row-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {end || (onClick && <ChevronRight size={17} />)}
    </>
  );
  return onClick ? (
    <button className="action-row" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="action-row">{content}</div>
  );
}
export function Arrow() {
  return <ArrowRight size={18} />;
}
export function BrandMark() {
  return (
    <span className="brand-mark">
      <ScanLine size={25} />
    </span>
  );
}
export function CheckMark() {
  return (
    <span className="check-mark">
      <Check size={22} />
    </span>
  );
}
export function timeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
}) {
  const panel = useRef<HTMLElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const mounted = useRef(true);
  const [exiting, setExiting] = useState(false);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismiss = async () => {
    if (closing.current) return;
    closing.current = true;
    if (
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      panel.current?.animate
    ) {
      setExiting(true);
      await panel.current
        .animate(
          [
            {
              transform: getComputedStyle(panel.current).transform,
              opacity: 1,
            },
            { transform: "translateY(24px)", opacity: 0 },
          ],
          { duration: 170, easing: "ease-in", fill: "forwards" },
        )
        .finished.catch(() => {});
    }
    if (mounted.current) closeRef.current();
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useLayoutEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement;
    const backgrounds = [
      ...document.querySelectorAll<HTMLElement>(".shell-body, .bottom-nav"),
    ];
    backgrounds.forEach((el) => {
      el.inert = true;
    });
    const elements = () =>
      [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) || []),
      ].filter((el) => el.getClientRects().length);
    (
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ||
      elements()[0] ||
      panel.current
    )?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void dismissRef.current();
      }
      if (event.key === "Tab") {
        const list = elements();
        const first = list[0];
        const last = list.at(-1);
        if (!list.length) {
          event.preventDefault();
          panel.current?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      mounted.current = false;
      document.removeEventListener("keydown", keys);
      backgrounds.forEach((el) => {
        el.inert = false;
      });
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div ref={root} className={`sheet-overlay ${exiting ? "exiting" : ""}`}>
      <button
        className="sheet-scrim"
        aria-label="Dismiss dialog"
        tabIndex={-1}
        onClick={() => void dismiss()}
      />
      <section
        className="sheet"
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sheet-handle" />
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            className="circle"
            aria-label="Close"
            disabled={exiting}
            onClick={() => void dismiss()}
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.querySelector(".device") || document.body,
  );
}
