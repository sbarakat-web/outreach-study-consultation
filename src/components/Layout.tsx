import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout() {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-bold transition ${isActive ? "bg-navy text-white" : "text-navy hover:bg-navy/5"}`;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-red to-brand-violet text-sm text-white">
            OR
          </span>
          <span className="hidden sm:inline">Outreach Recruitment</span>
        </Link>
        <nav className="flex items-center gap-1">
          {session ? (
            <>
              <NavLink to="/dashboard" className={navClass}>
                My requests
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
              <button
                className="rounded-full px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-navy/5"
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClass}>
              Sign in
            </NavLink>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
