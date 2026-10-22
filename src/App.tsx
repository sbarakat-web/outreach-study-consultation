import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { supabaseConfigured } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { Alert, Spinner } from "./components/ui";
import { Apply } from "./pages/Apply";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { CallPage, CandidateLayout, DocumentsPage, InvitePage } from "./pages/Dashboard";

// Heavy, staff-only screens (PDF, animation, admin tables) load on demand.
const OnlineSessions = lazy(() => import("./pages/sessions/OnlineSessions").then((m) => ({ default: m.OnlineSessions })));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const Requests = lazy(() => import("./pages/admin/Requests").then((m) => ({ default: m.Requests })));
const Team = lazy(() => import("./pages/admin/Team").then((m) => ({ default: m.Team })));

export function App() {
  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Alert>
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and fill in{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </Alert>
      </div>
    );
  }

  return (
    <I18nProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="onlinesessions" element={<OnlineSessions />} />
          <Route element={<Layout />}>
            <Route index element={<Apply />} />
            <Route path="login" element={<Login />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route
              path="dashboard"
              element={
                <RequireAuth candidate>
                  <CandidateLayout />
                </RequireAuth>
              }
            >
              <Route index element={<CallPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="invite" element={<InvitePage />} />
            </Route>
            <Route
              path="admin"
              element={
                <RequireAuth admin>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Requests />} />
              <Route path="team" element={<Team />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  );
}
