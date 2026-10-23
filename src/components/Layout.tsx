import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { Globe, LogOut, MessageCircle, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { waLink, whatsappNumber } from "../lib/options";
import { useI18n } from "../lib/i18n";

const WEBSITE = "https://outreachstudy.eu";

export function Layout() {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  // Inside the signed-in app (dashboard/admin): no footer, tab bar on phones.
  const inApp = /^\/(dashboard|admin)(\/|$)/.test(useLocation().pathname);

  const [q, setQ] = useState("");
  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/admin?q=${encodeURIComponent(q.trim())}`);
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-bold transition ${isActive ? "bg-brand text-white shadow-sm" : "text-navy hover:bg-brand/5"}`;

  return (
    <div className={`flex min-h-dvh flex-col ${inApp ? "app-ui" : ""}`}>
      <header
        className={`sticky top-0 z-40 ${inApp ? "bg-white shadow-[0_2px_14px_rgba(20,18,58,0.07)]" : "border-b border-slate-200/70 bg-white/90 backdrop-blur"}`}
      >
        {!inApp && <div aria-hidden className="h-1 bg-brand" />}
        <div className={`mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 ${inApp ? "h-16 sm:h-[70px]" : "py-3"}`}>
          <Link to={isAdmin ? "/admin" : session ? "/dashboard" : "/"} aria-label="Outreach — home" className="shrink-0">
            <img src="/logo.png" alt="Outreach — Study in Malta" width={1102} height={180} className="h-7 w-auto max-w-[52vw] sm:h-10 sm:max-w-none" />
          </Link>
          {inApp && isAdmin && (
            <form onSubmit={search} role="search" className="hidden max-w-md flex-1 md:flex">
              <label className="relative flex-1">
                <span className="sr-only">Search leads</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search leads"
                  className="h-10 w-full rounded-l-md bg-slate-100 pl-11 pr-3 text-sm text-navy outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <button type="submit" className="h-10 rounded-r-md bg-brand px-5 text-sm font-bold text-white hover:bg-brand/90">
                Search
              </button>
            </form>
          )}
          <nav className="flex items-center gap-1">
            {session ? (
              <>
                {!inApp &&
                  (isAdmin ? (
                    <NavLink to="/admin" className={navClass}>
                      {t("nav.admin")}
                    </NavLink>
                  ) : (
                    <NavLink to="/dashboard" className={navClass}>
                      {t("nav.myApplication")}
                    </NavLink>
                  ))}
                {inApp && (
                  <Link
                    to={isAdmin ? "/admin/settings" : "/dashboard/settings"}
                    aria-label="My account"
                    title={session.user.email ?? ""}
                    className="flex items-center gap-3 rounded-full py-1 pl-1 pr-1 text-[15px] text-slate-500 transition hover:text-navy sm:pr-3"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-bold uppercase text-white">{(session.user.email ?? "?")[0]}</span>
                    <span className="hidden max-w-[12rem] truncate sm:inline">{session.user.email}</span>
                  </Link>
                )}
                <button
                  aria-label={t("nav.signOut")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-brand/5 hover:text-navy ${inApp ? "md:hidden" : ""}`}
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  <LogOut className="h-4 w-4" /> <span className={inApp ? "sr-only" : "hidden sm:inline"}>{t("nav.signOut")}</span>
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-bold text-brand ring-1 ring-brand/30 transition hover:bg-brand hover:text-white"
              >
                {t("nav.signIn")}
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-6xl min-w-0 flex-1 px-3 pt-2 sm:px-6 ${inApp ? "pb-8" : "pb-16"}`}>
        <Outlet />
      </main>

      {!inApp && (
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <img src="/logo.png" alt="Outreach — Study in Malta" width={1102} height={180} className="h-8 w-auto" loading="lazy" />
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-navy">{t("footer.yourApplication")}</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-slate-600 hover:text-brand">
                  {t("footer.apply")}
                </Link>
              </li>
              <li>
                <Link to={session ? (isAdmin ? "/admin" : "/dashboard") : "/login"} className="text-slate-600 hover:text-brand">
                  {session ? (isAdmin ? t("nav.admin") : t("nav.myApplication")) : t("footer.openDashboard")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-navy">{t("footer.contact")}</p>
            <ul className="space-y-2 text-sm">
              {whatsappNumber && (
                <li>
                  <a href={waLink(whatsappNumber)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </li>
              )}
              <li>
                <a href={WEBSITE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand">
                  <Globe className="h-4 w-4" /> outreachstudy.eu
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-400 sm:px-6">
            © {new Date().getFullYear()} Outreach — Study in Malta. {t("footer.rights")}
          </p>
        </div>
      </footer>
      )}
    </div>
  );
}
