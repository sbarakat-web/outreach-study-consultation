import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Globe, Languages, LogOut, MessageCircle } from "lucide-react";
import { AdminSearch } from "./AdminSearch";
import { useAuth } from "../lib/auth";
import { waLink, whatsappNumber } from "../lib/options";
import { LANGS, useI18n, type Lang } from "../lib/i18n";

const WEBSITE = "https://outreachstudy.eu";

export function Layout() {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const activeLanguage = LANGS.find((language) => language.code === lang) ?? LANGS[0];
  // Inside the signed-in app (dashboard/admin): no footer, tab bar on phones.
  const inApp = /^\/(dashboard|admin)(\/|$)/.test(useLocation().pathname);

  useEffect(() => {
    if (!languageOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [languageOpen]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-bold transition ${isActive ? "bg-brand text-white shadow-sm" : "text-navy hover:bg-brand/5"}`;

  return (
    <div dir={isAdmin ? "ltr" : undefined} className={`flex min-h-dvh flex-col ${inApp ? "app-ui" : ""}`}>
      <header
        className={`sticky top-0 z-40 ${inApp ? "bg-white shadow-[0_2px_14px_rgba(20,18,58,0.07)]" : "border-b border-slate-200/70 bg-white/90 backdrop-blur"}`}
      >
        {!inApp && <div aria-hidden className="h-1 bg-brand" />}
        <div className={`mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 ${inApp ? "h-16 sm:h-[70px]" : "py-3"}`}>
          <Link to={isAdmin ? "/admin" : session ? "/dashboard" : "/"} aria-label="Outreach — home" className="shrink-0">
            <img src="/logo.png" alt="Outreach — Study in Malta" width={1102} height={180} className="h-7 w-auto max-w-[52vw] sm:h-10 sm:max-w-none" />
          </Link>
          {inApp && isAdmin && <AdminSearch />}
          <nav className="flex items-center gap-1">
            {!isAdmin && (
              <div ref={languageMenuRef} className="relative">
                <button
                  type="button"
                  aria-label={`${t("nav.language")}: ${activeLanguage.label}`}
                  aria-haspopup="menu"
                  aria-expanded={languageOpen}
                  onClick={() => setLanguageOpen((open) => !open)}
                  className="group inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 text-sm font-bold text-navy shadow-sm transition hover:border-brand/30 hover:bg-brand/[0.03] hover:shadow md:px-3"
                >
                  <span aria-hidden className="text-xl leading-none">{activeLanguage.flag}</span>
                  <span className="hidden sm:inline">{activeLanguage.label}</span>
                  <ChevronDown aria-hidden className={`h-3.5 w-3.5 text-slate-400 transition-transform ${languageOpen ? "rotate-180" : ""}`} />
                </button>

                {languageOpen && (
                  <div
                    role="menu"
                    aria-label={t("nav.language")}
                    className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(20,18,58,0.16)]"
                  >
                    <div className="flex items-center gap-2 px-3 pb-2 pt-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                      <Languages aria-hidden className="h-3.5 w-3.5" /> {t("nav.language")}
                    </div>
                    {LANGS.map((language) => (
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={language.code === lang}
                        key={language.code}
                        onClick={() => {
                          setLang(language.code as Lang);
                          setLanguageOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-bold transition ${
                          language.code === lang ? "bg-brand/10 text-brand" : "text-navy hover:bg-slate-50"
                        }`}
                      >
                        <span aria-hidden className="text-xl leading-none">{language.flag}</span>
                        <span className="flex-1">{language.label}</span>
                        {language.code === lang && <Check aria-hidden className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
