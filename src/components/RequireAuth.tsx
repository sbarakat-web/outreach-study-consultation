import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui";

// admin: only admins; candidate: admins are sent to the admin area instead.
export function RequireAuth({ admin, candidate, children }: { admin?: boolean; candidate?: boolean; children: ReactNode }) {
  const { session, isAdmin, isPresenter, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (candidate && isAdmin) return <Navigate to="/admin" replace />;
  if (candidate && isPresenter) return <Navigate to="/onlinesessions?present=1" replace />;
  return <>{children}</>;
}
