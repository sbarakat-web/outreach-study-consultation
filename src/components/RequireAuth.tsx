import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui";

export function RequireAuth({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
