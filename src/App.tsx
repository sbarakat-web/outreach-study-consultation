import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { supabaseConfigured } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { SeoController } from "./components/SeoController";
import { Alert, Spinner } from "./components/ui";
import { Apply } from "./pages/Apply";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { CallPage, CandidateLayout, DocumentsPage, InvitePage, ProgrammePage, SettingsPage } from "./pages/Dashboard";

// Heavy, staff-only screens (PDF, animation, admin tables) load on demand.
const EmailPreferences = lazy(() => import("./pages/EmailPreferences").then((m) => ({ default: m.EmailPreferences })));
const ConfirmCall = lazy(() => import("./pages/ConfirmCall").then((m) => ({ default: m.ConfirmCall })));
const OnlineSessions = lazy(() => import("./pages/sessions/OnlineSessions").then((m) => ({ default: m.OnlineSessions })));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const Requests = lazy(() => import("./pages/admin/Requests").then((m) => ({ default: m.Requests })));
const CalendarPage = lazy(() => import("./pages/admin/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const SessionsDashboard = lazy(() => import("./pages/admin/SessionsDashboard").then((m) => ({ default: m.SessionsDashboard })));
const AdminAccount = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminAccount })));
const Team = lazy(() => import("./pages/admin/Team").then((m) => ({ default: m.Team })));
const EmailMarketing = lazy(() => import("./pages/admin/EmailMarketing").then((m) => ({ default: m.EmailMarketing })));

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
        <SeoController />
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="onlinesessions" element={<OnlineSessions />} />
          <Route element={<Layout />}>
            <Route index element={<Apply />} />
            <Route path="login" element={<Login />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="confirm-call" element={<ConfirmCall />} />
            <Route path="email-preferences" element={<EmailPreferences />} />
            <Route
              path="dashboard"
              element={
                <RequireAuth candidate>
                  <CandidateLayout />
                </RequireAuth>
              }
            >
              <Route index element={<CallPage />} />
              <Route path="programme" element={<ProgrammePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="invite" element={<InvitePage />} />
              <Route path="settings" element={<SettingsPage />} />
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
              <Route path="new-leads" element={<Requests key="new" mode="new" />} />
              <Route path="documents" element={<Requests key="documents" mode="documents" />} />
              <Route path="not-interested" element={<Requests key="not_interested" mode="not_interested" />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="sessions" element={<SessionsDashboard />} />
              <Route path="team" element={<Team />} />
              <Route path="email-marketing" element={<EmailMarketing />} />
              <Route path="settings" element={<AdminAccount />} />
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
