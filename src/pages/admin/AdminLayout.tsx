import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, Presentation, Users, UsersRound } from "lucide-react";

const items = [
  { to: "/admin", label: "Leads", icon: UsersRound, end: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/onlinesessions?present=1", label: "Online sessions", icon: Presentation },
  { to: "/admin/team", label: "Team", icon: Users },
];

export function AdminLayout() {
  return (
    <div className="grid gap-6 pt-4 md:grid-cols-[13rem_1fr]">
      <aside className="md:sticky md:top-24 md:self-start">
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto rounded-2xl bg-white/60 p-1.5 ring-1 ring-slate-200 md:flex-col">
          {items.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  isActive ? "bg-brand text-white" : "text-navy hover:bg-white"
                }`
              }
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
