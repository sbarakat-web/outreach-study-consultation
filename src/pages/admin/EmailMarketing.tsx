import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, CheckCircle2, Clock3, Eye, Mail, MousePointerClick, RefreshCw, Send, UserPlus } from "lucide-react";
import { Alert, Button, Card, Spinner } from "../../components/ui";
import { PageTitle, StatStrip } from "../../components/dash";
import { supabase } from "../../lib/supabase";
import { Campaigns } from "./marketing/Campaigns";
import { Templates } from "./marketing/Templates";
import { Library } from "./marketing/Library";
import { FooterSettings } from "./marketing/FooterSettings";

const TABS = [
  { key: "campaigns", label: "Campaigns" },
  { key: "templates", label: "Templates" },
  { key: "library", label: "Image library" },
  { key: "footer", label: "Footer" },
  { key: "invites", label: "Account invitations" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function EmailMarketing() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return (TABS.find((x) => x.key === t)?.key ?? "campaigns") as Tab;
  });
  const choose = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `?tab=${t}`);
  };
  return (
    <div className="space-y-6">
      <PageTitle>Email marketing</PageTitle>
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-md bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => choose(t.key)}
            className={`shrink-0 rounded px-4 py-2 text-sm font-bold transition ${tab === t.key ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "campaigns" && <Campaigns />}
      {tab === "templates" && <Templates />}
      {tab === "library" && <Library />}
      {tab === "footer" && <FooterSettings />}
      {tab === "invites" && <Invitations onEditTemplate={() => choose("templates")} />}
    </div>
  );
}

// ------------------------------------------------------------ account invitations

type MarketingStatus = "draft" | "sent" | "opened" | "clicked" | "account_created" | "unsubscribed" | "failed";
interface Contact {
  id: string;
  full_name: string;
  email: string;
  status: MarketingStatus;
  send_count: number;
  open_count: number;
  click_count: number;
  follow_up_count: number;
  last_sent_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  account_created_at: string | null;
  unsubscribed_at: string | null;
  last_error: string | null;
  created_at: string;
}

const statusStyle: Record<MarketingStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  opened: "bg-violet-50 text-violet-700",
  clicked: "bg-amber-50 text-amber-700",
  account_created: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  unsubscribed: "bg-slate-100 text-slate-600",
};
const statusLabel: Record<MarketingStatus, string> = { draft: "Draft", sent: "Sent", opened: "Opened", clicked: "Clicked", account_created: "Account created", unsubscribed: "Unsubscribed", failed: "Failed" };
const formatDate = (value: string | null) => (value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—");
const journey = [
  { key: "sent", label: "Invite sent", icon: Send },
  { key: "opened", label: "Opened", icon: Eye },
  { key: "clicked", label: "Clicked", icon: MousePointerClick },
  { key: "account_created", label: "Account created", icon: CheckCircle2 },
] as const;

function completedStep(contact: Contact) {
  if (contact.status === "account_created") return 3;
  if (contact.click_count > 0 || contact.status === "clicked") return 2;
  if (contact.open_count > 0 || contact.status === "opened") return 1;
  if (contact.send_count > 0 || contact.status === "sent") return 0;
  return -1;
}

function Invitations({ onEditTemplate }: { onEditTemplate: () => void }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("marketing_contacts").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setContacts((data as Contact[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("marketing-contacts-admin").on("postgres_changes", { event: "*", schema: "public", table: "marketing_contacts" }, load).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const sendInvite = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-marketing-invite", { body: { full_name: fullName.trim(), email: email.trim().toLowerCase() } });
    setSending(false);
    if (error || data?.error) return setError(data?.error || error?.message || "The invitation could not be sent.");
    setSuccess(`Invitation sent to ${email.trim().toLowerCase()}.`);
    setFullName("");
    setEmail("");
    load();
  };

  const stats = useMemo(
    () => ({
      sent: contacts?.filter((item) => item.send_count > 0).length ?? 0,
      opened: contacts?.filter((item) => item.open_count > 0).length ?? 0,
      clicked: contacts?.filter((item) => item.click_count > 0).length ?? 0,
      created: contacts?.filter((item) => item.status === "account_created").length ?? 0,
    }),
    [contacts],
  );

  if (!contacts) return <Spinner />;
  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          { icon: Send, label: "Invitations sent", value: stats.sent, tone: "text-blue-600" },
          { icon: Eye, label: "Opened", value: stats.opened, tone: "text-violet-600" },
          { icon: MousePointerClick, label: "Clicked", value: stats.clicked, tone: "text-amber-600" },
          { icon: CheckCircle2, label: "Accounts created", value: stats.created, tone: "text-emerald-600" },
        ]}
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <Card>
        <form onSubmit={sendInvite} className="grid gap-4 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div className="flex items-center gap-3 lg:col-span-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-brand/10 text-brand">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">Send one invitation</h2>
              <p className="text-xs text-slate-500">
                Uses the “Account invite” template —{" "}
                <button type="button" onClick={onEditTemplate} className="font-bold text-brand hover:underline">
                  edit it in Templates
                </button>
                . A reminder goes out after 24h if no account is created.
              </p>
            </div>
          </div>
          <label>
            <span className="label">Full name</span>
            <input className="field" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Candidate full name" />
          </label>
          <label>
            <span className="label">Email address</span>
            <input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="candidate@example.com" />
          </label>
          <Button type="submit" loading={sending}>
            <Mail className="h-4 w-4" />
            Send invitation
          </Button>
        </form>
      </Card>

      <Card>
        <div className="px-5 py-6 sm:px-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Candidate journeys</h2>
              <p className="text-xs text-slate-500">One view from first email to account creation. Follow-ups stop automatically when the account is created.</p>
            </div>
            <button type="button" onClick={load} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No invitations sent yet.</p>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => {
                const current = completedStep(contact);
                const progress = current < 0 ? 0 : ((current + 1) / journey.length) * 100;
                const lastActivity = contact.account_created_at || contact.unsubscribed_at || contact.last_clicked_at || contact.last_opened_at || contact.last_follow_up_at || contact.last_sent_at || contact.created_at;
                return (
                  <article key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-900">{contact.full_name}</h3>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[contact.status]}`}>{statusLabel[contact.status]}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{contact.email}</p>
                      </div>
                      <div className="text-left text-xs text-slate-500 sm:text-right">
                        <p>Last activity: {formatDate(lastActivity)}</p>
                        {contact.follow_up_count > 0 ? (
                          <p className="mt-1 font-semibold text-amber-700">24-hour reminder sent</p>
                        ) : contact.next_follow_up_at && contact.status !== "account_created" ? (
                          <p className="mt-1 inline-flex items-center gap-1 font-semibold text-slate-600">
                            <Clock3 className="h-3.5 w-3.5" />
                            Follow-up {formatDate(contact.next_follow_up_at)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1">
                      {journey.map((step, index) => {
                        const done = index <= current;
                        const Icon = step.icon;
                        return (
                          <div key={step.key} className="text-center">
                            <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-2 ${done ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-400"}`}>
                              {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                            </span>
                            <span className={`mt-1.5 block text-[10px] font-bold leading-tight sm:text-xs ${done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {contact.last_error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{contact.last_error}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
