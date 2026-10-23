// Building blocks of the dashboard look (candidate + admin), modelled on the "Boardash" template:
// floating sidebar card, stat strip with round icons, meeting-style cards.
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { MobileTabBar, type TabItem } from "./TabBar";

/** Round avatar: photo, or the first letter on brand purple. */
export function Avatar({ name, photo, size = 44 }: { name: string; photo?: string | null; size?: number }) {
  return photo ? (
    <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-brand font-bold uppercase text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name.trim() || "?").slice(0, 1)}
    </span>
  );
}

const sideItemClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex items-center gap-4 px-7 py-3.5 text-[15px] transition ${
    isActive ? "bg-brand/[0.06] font-bold text-brand before:absolute before:inset-y-0 before:start-0 before:w-1 before:bg-brand" : "text-slate-500 hover:bg-slate-50 hover:text-navy"
  }`;

/**
 * Signed-in shell: floating white sidebar card ("Welcome, Name!" + role, nav, log out) on desktop,
 * bottom tab bar on phones, and a round floating action button.
 */
export function AppShell({
  name,
  role,
  photo,
  items,
  mobileItems,
  label,
  onSignOut,
  signOutLabel,
  welcome,
  fab,
  children,
}: {
  name: string;
  role: string;
  photo?: string | null;
  items: TabItem[];
  mobileItems?: TabItem[];
  label: string;
  onSignOut: () => void;
  signOutLabel: string;
  welcome: string;
  fab?: ReactNode;
  children: ReactNode;
}) {
  const location = useLocation();
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pb-24 pt-3 sm:gap-6 sm:pt-4 md:grid-cols-[16rem_minmax(0,1fr)] md:pb-10 md:pt-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="hidden md:sticky md:top-24 md:block md:self-start">
        <div className="ui-card overflow-hidden rounded-md bg-white pb-4">
          <div className="relative flex items-center gap-3 px-6 pb-5 pt-6">
            <Avatar name={name} photo={photo} size={42} />
            <div className="min-w-0">
              <p className="truncate text-[15px] text-slate-600">{welcome}</p>
              <p className="truncate text-xs text-slate-400">{role}</p>
            </div>
            {/* Bookmark ribbon from the template, in brand purple */}
            <svg aria-hidden viewBox="0 0 14 20" className="absolute right-6 top-0 h-5 w-3.5 fill-brand">
              <path d="M0 0h14v20l-7-5-7 5z" />
            </svg>
          </div>
          <nav aria-label={label} className="flex flex-col">
            {items.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  sideItemClass({
                    isActive: t.to.includes("?")
                      ? `${location.pathname}${location.search}` === t.to
                      : t.end && location.pathname === t.to && location.search
                        ? false
                        : isActive,
                  })
                }
              >
                <t.icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                <span className="flex-1 truncate">{t.label}</span>
                {t.badge}
              </NavLink>
            ))}
            <button onClick={onSignOut} className="mt-6 flex items-center gap-4 px-7 py-3.5 text-left text-[15px] text-slate-500 transition hover:bg-slate-50 hover:text-navy">
              <LogOut className="h-[18px] w-[18px] opacity-80" /> {signOutLabel}
            </button>
          </nav>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
      {fab && <div className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6">{fab}</div>}
      <MobileTabBar items={mobileItems ?? items} label={label} />
    </div>
  );
}

/** Round floating action button (template's bottom-right bell). */
export function Fab({ href, to, label, icon: Icon, badge, className = "bg-brand" }: { href?: string; to?: string; label: string; icon: LucideIcon; badge?: number; className?: string }) {
  const inner = (
    <>
      <Icon className="h-6 w-6" />
      {!!badge && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white ring-2 ring-white">
          {badge}
        </span>
      )}
    </>
  );
  const cls = `relative grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_8px_24px_rgba(68,45,250,0.35)] transition hover:scale-105 ${className}`;
  return to ? (
    <NavLink to={to} aria-label={label} title={label} className={cls}>
      {inner}
    </NavLink>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={cls}>
      {inner}
    </a>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[28px] font-bold leading-tight text-navy">{children}</h1>
      {actions}
    </div>
  );
}

export interface Stat {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
  onClick?: () => void;
}

/** White strip of stats with round grey icons and big numbers. Scrolls sideways on phones. */
export function StatStrip({ items }: { items: Stat[] }) {
  return (
    <div className="mobile-scroll ui-card snap-x snap-mandatory overflow-x-auto rounded-md bg-white">
      <div className="flex min-w-max py-4 sm:min-w-0 sm:flex-wrap sm:gap-y-4">
        {items.map((s) => {
          const body = (
            <>
              <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-slate-100 xl:h-[64px] xl:w-[64px] ${s.tone ?? "text-slate-400"}`}>
                <s.icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.6} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-[13px] text-navy">{s.label}</span>
                <span className="block text-[28px] font-bold leading-tight text-navy sm:text-[32px]">{s.value}</span>
                {s.sub && <span className="block truncate text-[11px] text-slate-400">{s.sub}</span>}
              </span>
            </>
          );
          const cls = "flex min-w-[calc(100vw-1.5rem)] snap-start items-center gap-4 border-slate-100 px-5 sm:min-w-[12.5rem] sm:flex-1 [&+&]:border-l";
          return s.onClick ? (
            <button key={s.label} onClick={s.onClick} className={`${cls} transition hover:bg-slate-50`}>
              {body}
            </button>
          ) : (
            <div key={s.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "Meeting" card from the template: avatar + title/email/time, a coloured status row, and a footer action. */
export function MeetingCard({
  name,
  photo,
  title,
  subtitle,
  time,
  status,
  footer,
}: {
  name: string;
  photo?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  time?: ReactNode;
  status?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <li className="ui-card flex flex-col overflow-hidden rounded-md bg-white">
      <div className="flex items-center gap-5 px-6 py-5">
        <Avatar name={name} photo={photo} size={72} />
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-bold text-navy">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
          {time && <p className="text-[15px] text-slate-600">{time}</p>}
        </div>
      </div>
      {status && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-3 text-xs">{status}</div>}
      <div className="mt-auto flex border-t border-slate-100 text-[15px] text-slate-600 [&>*]:flex-1 [&>*]:py-3.5 [&>*]:text-center [&>*+*]:border-l [&>*+*]:border-slate-100">
        {footer}
      </div>
    </li>
  );
}
