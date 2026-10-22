import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BarChart3, Bell, CalendarDays, Mail, Presentation, Settings, Users, UsersRound } from "lucide-react";
import type { TabItem } from "../../components/TabBar";
import { AppShell, Fab } from "../../components/dash";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { AccountSettings } from "../Settings";

const sidebar: TabItem[] = [
  { to: "/admin", label: "Leads", icon: UsersRound, end: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/onlinesessions?present=1", label: "Online sessions", icon: Presentation },
  { to: "/admin/sessions", label: "Session stats", icon: BarChart3 },
  { to: "/admin/email-marketing", label: "Email marketing", icon: Mail },
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
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const email = (session?.user.email ?? "").toLowerCase();
  const [profile, setProfile] = useState<{ display_name: string | null; photo_url: string | null } | null>(null);
  const [toConfirm, setToConfirm] = useState(0);

  useEffect(() => {
    supabase.from("staff_profiles").select("display_name, photo_url").eq("email", email).maybeSingle().then(({ data }) => setProfile(data));
    // Requests not confirmed yet (bell badge → Calendar "To confirm")
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("call_status", "requested")
      .is("call_declined_at", null)
      .then(({ count }) => setToConfirm(count ?? 0));
  }, [email]);

  const name = profile?.display_name || email.split("@")[0];

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
