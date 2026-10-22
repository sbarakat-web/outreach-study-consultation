import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, CalendarDays, Presentation, Settings, Users, UsersRound } from "lucide-react";
import { MobileTabBar, sideLinkClass, type TabItem } from "../../components/TabBar";
import { AccountSettings } from "../Settings";

const sidebar: TabItem[] = [
  { to: "/admin", label: "Leads", icon: UsersRound, end: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/onlinesessions?present=1", label: "Online sessions", icon: Presentation },
  { to: "/admin/sessions", label: "Session stats", icon: BarChart3 },
  { to: "/admin/team", label: "Team", icon: Users },
  { to: "/admin/settings", label: "My account", icon: Settings },
];

// Phones: five tabs; Team is reachable from My account.
const tabs: TabItem[] = [
  { to: "/admin", label: "Leads", icon: UsersRound, end: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/onlinesessions?present=1", label: "Sessions", icon: Presentation },
  { to: "/admin/sessions", label: "Stats", icon: BarChart3 },
  { to: "/admin/settings", label: "Account", icon: Settings },
];

export function AdminLayout() {
  return (
    <div className="grid gap-6 pb-24 pt-2 md:grid-cols-[13rem_1fr] md:pb-0 md:pt-4">
      <aside className="hidden md:sticky md:top-24 md:block md:self-start">
        <nav aria-label="Admin" className="flex flex-col gap-1 rounded-2xl bg-white/60 p-1.5 ring-1 ring-slate-200">
          {sidebar.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={sideLinkClass}>
              <span className="flex items-center gap-2">
                <t.icon className="h-4 w-4" /> {t.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
      <MobileTabBar items={tabs} label="Admin" />
    </div>
  );
}

export function AdminAccount() {
  return (
    <div className="max-w-3xl">
      <AccountSettings staff />
    </div>
  );
}
