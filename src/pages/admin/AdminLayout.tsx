import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Bell, CalendarDays, Mail, Plus, Presentation, Settings, UserCheck, UserRoundCheck, UserRoundX, Users, UsersRound } from "lucide-react";
import type { TabItem } from "../../components/TabBar";
import { AppShell, Fab } from "../../components/dash";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { AccountSettings } from "../Settings";

// Phones: five tabs; Team is reachable from My account.
const tabs: TabItem[] = [
  { to: "/admin", label: "Leads", icon: UsersRound, end: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/onlinesessions?present=1", label: "Sessions", icon: Presentation },
  { to: "/admin/sessions", label: "Stats", icon: BarChart3 },
  { to: "/admin/settings", label: "Account", icon: Settings },
];

export function AdminLayout() {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const email = (session?.user.email ?? "").toLowerCase();
  const [profile, setProfile] = useState<{ display_name: string | null; photo_url: string | null } | null>(null);
  const [toConfirm, setToConfirm] = useState(0);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from("staff_profiles").select("display_name, photo_url").eq("email", email).maybeSingle().then(({ data }) => setProfile(data));
    // Requests not confirmed yet (bell badge → Calendar "To confirm")
    const loadCounts = async () => {
      const [{ count }, { data }] = await Promise.all([
        supabase.from("consultations").select("id", { count: "exact", head: true }).eq("call_status", "requested").is("call_declined_at", null),
        supabase.from("consultations").select("status"),
      ]);
      setToConfirm(count ?? 0);
      setLeadCounts((data ?? []).reduce<Record<string, number>>((out, row) => {
        out[row.status] = (out[row.status] ?? 0) + 1;
        return out;
      }, {}));
    };
    loadCounts();
    const channel = supabase.channel("admin-lead-counts").on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, loadCounts).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [email]);

  const name = profile?.display_name || email.split("@")[0];
  const countBadge = (value: number) => value ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{value}</span> : undefined;
  const sidebar: TabItem[] = [
    { to: "/admin", label: "All leads", icon: UsersRound, end: true, badge: countBadge(Object.values(leadCounts).reduce((a, b) => a + b, 0)) },
    { to: "/admin?new=1", label: "Add new lead", icon: Plus },
    { to: "/admin?status=new", label: "New leads", icon: UsersRound, badge: countBadge(leadCounts.new ?? 0) },
    { to: "/admin?status=consultation_booked", label: "Consultation booked", icon: CalendarDays, badge: countBadge(leadCounts.consultation_booked ?? 0) },
    { to: "/admin?status=interviewed", label: "Interviewed", icon: UserCheck, badge: countBadge(leadCounts.interviewed ?? 0) },
    { to: "/admin?status=no_show", label: "No-show", icon: UserRoundX, badge: countBadge(leadCounts.no_show ?? 0) },
    { to: "/admin?status=not_interested", label: "No longer interested", icon: UserRoundCheck, badge: countBadge(leadCounts.not_interested ?? 0) },
    { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/onlinesessions?present=1", label: "Online sessions", icon: Presentation },
    { to: "/admin/sessions", label: "Session stats", icon: BarChart3 },
    { to: "/admin/email-marketing", label: "Email marketing", icon: Mail },
    { to: "/admin/team", label: "Team", icon: Users },
    { to: "/admin/settings", label: "My account", icon: Settings },
  ];

  return (
    <AppShell
      name={name}
      photo={profile?.photo_url}
      welcome={`Welcome, ${name}!`}
      role={isAdmin ? "Admin" : "Presenter"}
      items={sidebar}
      mobileItems={tabs}
      label="Admin"
      signOutLabel="Log out"
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      fab={<Fab to="/admin/calendar" label={`${toConfirm} call requests to confirm`} icon={Bell} badge={toConfirm} />}
    >
      <Outlet />
    </AppShell>
  );
}

export function AdminAccount() {
  return (
    <div className="max-w-3xl">
      <AccountSettings staff />
    </div>
  );
}
