import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Globe, LogOut, MessageCircle } from "lucide-react";
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

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-bold transition ${isActive ? "bg-brand text-white shadow-sm" : "text-navy hover:bg-brand/5"}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div aria-hidden className="h-1 bg-brand" />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to={isAdmin ? "/admin" : session ? "/dashboard" : "/"} aria-label="Outreach — home" className="shrink-0">
            <img src="/logo.png" alt="Outreach — Study in Malta" width={1102} height={180} className="h-8 w-auto sm:h-10" />
          </Link>
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
                    className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-black uppercase text-white"
                  >
                    {(session.user.email ?? "?")[0]}
                  </Link>
                )}
                <button
                  aria-label={t("nav.signOut")}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-brand/5 hover:text-navy"
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t("nav.signOut")}</span>
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

      <main className={`mx-auto w-full max-w-6xl flex-1 px-4 pt-2 sm:px-6 ${inApp ? "pb-8" : "pb-16"}`}>
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
