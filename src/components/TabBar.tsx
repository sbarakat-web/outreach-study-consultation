import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: ReactNode;
}

/** Phone navigation: fixed bottom tab bar (the sidebar takes over from md up). */
export function MobileTabBar({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `relative flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-bold transition min-[390px]:px-1 min-[390px]:text-[11px] ${
                isActive ? "text-brand" : "text-slate-500 hover:text-navy"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" />}
                <span className="relative">
                  <t.icon className="h-5 w-5" />
                  {t.badge && <span className="absolute -right-3 -top-1.5">{t.badge}</span>}
                </span>
                <span className="w-full truncate px-0.5 text-center">{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Desktop sidebar link style shared by the candidate and admin areas. */
export const sideLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition ${
    isActive ? "bg-brand text-white" : "text-navy hover:bg-white"
  }`;
