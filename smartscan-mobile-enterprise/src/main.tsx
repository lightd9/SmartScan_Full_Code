import { Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceProvider } from "./app/context";
import Shell from "./app/Shell";
import Welcome from "./features/Welcome";
import SignIn from './features/SignIn';
import { isLive, dataMode } from './services/config';
import Home from "./features/Home";
import { ErrorNote, Loading } from "./design/ui";
import "./design/tokens.css";
import "./design/workflows.css";
import "./design/responsive.css";
import '../../native/web/viewport';
import '../../native/web/viewport.css';

const Inventory = lazy(() => import("./features/Inventory"));
const Scan = lazy(() => import("./features/Scan"));
const Review = lazy(() => import("./features/Review"));
const Product = lazy(() => import("./features/Product"));
const Register = lazy(() => import("./features/Register"));
const Operation = lazy(() => import("./features/Operations"));
const Activity = lazy(() =>
  import("./features/Operations").then((m) => ({ default: m.Activity })),
);
const Accounts = lazy(() => import("./features/Accounts"));
const More = lazy(() => import("./features/More"));
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 1000 } },
});

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="welcome">
        <h1>Let’s try that again.</h1>
        <ErrorNote>
          The workspace could not display this screen. Reload and check Activity for saved operations.
        </ErrorNote>
        <button className="primary" onClick={() => location.assign("/")}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const Handovers = lazy(() => import('./features/Handovers'));
const Reports = lazy(() => import('./features/Reports'));
function App() {
  // Fail closed: production integration must provide a real adapter. Never silently fall back to demo records.
  if (!['demo','live'].includes(dataMode))
    return (
      <main className="welcome">
        <h1>Connection not configured</h1>
        <p className="support">
          Live services have not been connected to this enterprise build. Demo
          data is disabled in this mode.
        </p>
      </main>
    );
  return (
    <QueryClientProvider client={client}>
      <WorkspaceProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/welcome" element={isLive ? <SignIn /> : <Welcome />} />
              <Route element={<Shell />}>
                <Route index element={<Home />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="scan" element={<Scan />} />
                <Route path="review" element={<Review />} />
                <Route path="products/:id" element={<Product />} />
                <Route path="register" element={<Register />} />
                <Route path="operations/:id" element={<Operation />} />
                <Route path="handovers" element={<Handovers />} />
                <Route path="reports" element={<Reports />} />
                <Route path="activity" element={<Activity />} />
                <Route path="operations" element={<Activity />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="accounts/:id" element={<Accounts />} />
                <Route path="more" element={<More />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <div className="device">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </div>,
);
