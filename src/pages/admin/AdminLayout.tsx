import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, CalendarCheck, CalendarDays, CalendarX2, Clock, FileCheck2, Mail, Presentation, School, Send, Settings, UserRoundX, Users, UsersRound } from "lucide-react";
import type { TabItem } from "../../components/TabBar";
import { AppShell, Fab } from "../../components/dash";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { isOverdue } from "../../lib/options";
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
  const [withDocs, setWithDocs] = useState(0);
  const [waitingCandidate, setWaitingCandidate] = useState(0);
  const [upcoming, setUpcoming] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [cancelled, setCancelled] = useState(0);
  const [newLeads, setNewLeads] = useState(0);

  useEffect(() => {
    supabase.from("staff_profiles").select("display_name, photo_url").eq("email", email).maybeSingle().then(({ data }) => setProfile(data));
    // Call counts: requests awaiting confirmation (bell badge) and suggested times the candidate hasn't accepted yet.
    const loadCounts = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("status, call_status, preferred_call_at, suggested_call_at, requested_call_times, call_declined_at, repick_requested_at, session_outcome, tracking, documents(count)");
      const leads = (data ?? []).filter((row) => row.tracking?.source !== "school_visa_process");
      setOverdue(leads.filter(isOverdue).length);
      const open = leads.filter((row) => row.status !== "not_interested" && !row.call_declined_at && row.call_status !== "confirmed" && !(row.tracking?.appointment_cancelled_at && row.call_status === "none"));
      setToConfirm(open.filter((row) => !row.suggested_call_at && (row.preferred_call_at || row.requested_call_times?.[0])).length);
      setWaitingCandidate(open.filter((row) => row.suggested_call_at || (row.call_status === "none" && row.repick_requested_at)).length);
      setUpcoming(leads.filter((row) => row.call_status === "confirmed" && row.preferred_call_at && !row.session_outcome && new Date(row.preferred_call_at).getTime() + 20 * 60_000 > Date.now()).length);
      setWithDocs(leads.filter((row) => row.status !== "not_interested" && !(row.tracking?.appointment_cancelled_at && row.call_status === "none") && (row.documents as { count: number }[] | null)?.[0]?.count).length);
      setCancelled(leads.filter((row) => row.tracking?.appointment_cancelled_at && row.call_status === "none").length);
      setNewLeads(leads.filter((row) => row.status === "new" && !(row.tracking?.appointment_cancelled_at && row.call_status === "none")).length);
      setLeadCounts(leads.reduce<Record<string, number>>((out, row) => {
        out[row.status] = (out[row.status] ?? 0) + 1;
        return out;
      }, {}));
    };
    loadCounts();
    const channel = supabase
      .channel("admin-lead-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, loadCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, loadCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [email]);

  const name = profile?.display_name || email.split("@")[0];
  const countBadge = (value: number) => value ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{value}</span> : undefined;
  const sidebar: TabItem[] = [
    {
      to: "/admin",
      label: "All leads",
      icon: UsersRound,
      end: true,
      badge: countBadge(Object.values(leadCounts).reduce((a, b) => a + b, 0) - withDocs - (leadCounts.not_interested ?? 0) - cancelled),
      children: [
        { to: "/admin/upcoming", label: "Upcoming", icon: CalendarCheck, badge: countBadge(upcoming) },
        {
          to: "/admin/overdue",
          label: "Overdue",
          icon: AlertTriangle,
          // Calls that happened with nothing recorded afterwards.
          badge: overdue ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-brand-red">{overdue}</span> : undefined,
        },
        {
          to: "/admin/awaiting-confirmation",
          label: "Awaiting confirmation",
          icon: Clock,
          // Calls to confirm (Meet link + Confirm & send).
          badge: toConfirm ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{toConfirm}</span> : undefined,
        },
        { to: "/admin/waiting-for-candidate", label: "Waiting for candidate", icon: Send, badge: countBadge(waitingCandidate) },
        { to: "/admin/cancelled-appointments", label: "Cancelled appointments", icon: CalendarX2, badge: countBadge(cancelled) },
        { to: "/admin/new-leads", label: "New leads", icon: UsersRound, badge: countBadge(newLeads) },
        { to: "/admin/documents", label: "Documents received", icon: FileCheck2, badge: countBadge(withDocs) },
        { to: "/admin/not-interested", label: "No longer interested", icon: UserRoundX, badge: countBadge(leadCounts.not_interested ?? 0) },
      ],
    },
    { to: "/admin/school-visa-process", label: "School / Visa Process", icon: School },
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
      fab={<Fab to="/admin/awaiting-confirmation" label={`${toConfirm} calls awaiting confirmation`} icon={Bell} badge={toConfirm} />}
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
