import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/admin", label: "Requests", end: true },
  { to: "/admin/slots", label: "Time slots" },
  { to: "/admin/team", label: "Team" },
];

export function AdminLayout() {
  return (
    <div className="space-y-6 pt-4">
      <nav className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:w-fit">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${isActive ? "bg-navy text-white" : "text-navy hover:bg-navy/5"}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
