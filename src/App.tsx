import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { supabaseConfigured } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { Alert } from "./components/ui";
import { Apply } from "./pages/Apply";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Requests } from "./pages/admin/Requests";
import { Slots } from "./pages/admin/Slots";
import { Team } from "./pages/admin/Team";

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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Apply />} />
            <Route path="login" element={<Login />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route
              path="dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="admin"
              element={
                <RequireAuth admin>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Requests />} />
              <Route path="slots" element={<Slots />} />
              <Route path="team" element={<Team />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
