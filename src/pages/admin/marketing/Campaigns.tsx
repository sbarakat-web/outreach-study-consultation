import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, Plus, Send, Users, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { STATUSES } from "../../../lib/options";
import { Alert, Button, Card, Spinner } from "../../../components/ui";
import { SpamPanel } from "./Preview";
import { useTemplates } from "./Templates";
import { loadSettings, type MarketingSettings } from "./shared";

interface Segment {
  preset?: "all" | "no_call" | "docs_missing";
  statuses?: string[];
  country?: string;
  course?: string;
}
interface Campaign {
  id: string;
  name: string;
  template_id: string | null;
  subject_a: string;
  subject_b: string | null;
  topic: "news" | "deadlines";
  segment: Segment;
  scheduled_at: string | null;
  local_morning: boolean;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  recipients: number;
  created_at: string;
  sent_at: string | null;
}
interface SendRow {
  campaign_id: string;
  variant: "a" | "b";
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribed_at: string | null;
  email: string;
}

const PRESETS = [
  { value: "all", label: "All candidates" },
  { value: "no_call", label: "Applied, no call booked yet" },
  { value: "docs_missing", label: "Interviewed, documents missing" },
] as const;

const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function stats(rows: SendRow[]) {
  const sent = rows.filter((r) => r.status === "sent");
  return {
    sent: sent.length,
    opened: sent.filter((r) => r.opened_at).length,
    clicked: sent.filter((r) => r.clicked_at).length,
    unsubscribed: rows.filter((r) => r.unsubscribed_at).length,
  };
}

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [sends, setSends] = useState<SendRow[]>([]);
  const [accounts, setAccounts] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [c, s, users] = await Promise.all([
      supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("marketing_sends").select("campaign_id, variant, status, opened_at, clicked_at, unsubscribed_at, email"),
      supabase.from("consultations").select("email, user_id"),
    ]);
    setCampaigns((c.data as Campaign[]) ?? []);
    setSends((s.data as SendRow[]) ?? []);
    setAccounts(new Set(((users.data ?? []) as { email: string; user_id: string | null }[]).filter((u) => u.user_id).map((u) => u.email)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!campaigns) return <Spinner />;

  const cancel = async (c: Campaign) => {
    if (!confirm(`Cancel “${c.name}”? Emails not sent yet will be dropped.`)) return;
    await supabase.functions.invoke("marketing-campaign", { body: { action: "cancel", campaignId: c.id } });
    load();
  };

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {creating ? (
        <NewCampaign
          onClose={() => setCreating(false)}
          onDone={(text) => {
            setCreating(false);
            setMsg({ tone: "success", text });
            load();
          }}
        />
      ) : (
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      )}

      {campaigns.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No campaigns yet.</p>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => {
            const rows = sends.filter((s) => s.campaign_id === c.id);
            const all = stats(rows);
            const a = stats(rows.filter((r) => r.variant === "a"));
            const b = stats(rows.filter((r) => r.variant === "b"));
            const created = rows.filter((r) => r.status === "sent" && accounts.has(r.email)).length;
            return (
              <li key={c.id}>
                <Card>
                  <div className="space-y-4 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-navy">{c.name}</h3>
                        <p className="text-xs text-slate-500">
                          {c.status === "scheduled" ? `Scheduled ${fmt(c.scheduled_at)}${c.local_morning ? " · each candidate's 9:00" : ""}` : c.status === "sent" ? `Sent ${fmt(c.sent_at)}` : c.status} · {c.recipients} recipients
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.status === "sent" ? "bg-emerald-50 text-emerald-700" : c.status === "cancelled" ? "bg-slate-100 text-slate-500" : "bg-sky-50 text-sky-700"}`}>{c.status}</span>
                        {["scheduled", "sending"].includes(c.status) && (
                          <button onClick={() => cancel(c)} className="text-xs font-bold text-brand-red hover:underline">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    <Bars
                      items={[
                        { label: "Sent", value: all.sent, of: c.recipients || all.sent },
                        { label: "Opened", value: all.opened, of: all.sent },
                        { label: "Clicked", value: all.clicked, of: all.sent },
                        { label: "Has account", value: created, of: all.sent },
                        { label: "Unsubscribed", value: all.unsubscribed, of: all.sent, bad: true },
                      ]}
                    />
                    {c.subject_b && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          { v: "A", subject: c.subject_a, s: a },
                          { v: "B", subject: c.subject_b, s: b },
                        ].map((x) => {
                          const win = pct(x.s.opened, x.s.sent) > pct((x.v === "A" ? b : a).opened, (x.v === "A" ? b : a).sent);
                          return (
                            <div key={x.v} className={`rounded-xl p-3 text-xs ring-1 ${win ? "bg-emerald-50 ring-emerald-200" : "bg-mist ring-slate-200"}`}>
                              <p className="font-bold text-navy">
                                Subject {x.v} {win && "· winner"}
                              </p>
                              <p className="truncate text-slate-500">{x.subject}</p>
                              <p className="mt-1 text-slate-600">
                                Opened {pct(x.s.opened, x.s.sent)}% · Clicked {pct(x.s.clicked, x.s.sent)}% ({x.s.sent} sent)
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Small horizontal bar chart: share of the base for each metric. */
function Bars({ items }: { items: { label: string; value: number; of: number; bad?: boolean }[] }) {
  return (
    <div className="space-y-1.5" aria-label="Campaign results">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="text-slate-500">{i.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <span className={`block h-full rounded-full ${i.bad ? "bg-brand-red/70" : "bg-brand"}`} style={{ width: `${pct(i.value, i.of)}%` }} />
          </span>
          <span className="text-right font-bold text-navy">
            {i.value} <span className="font-normal text-slate-400">{pct(i.value, i.of)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function NewCampaign({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const { templates } = useTemplates();
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [subjectA, setSubjectA] = useState("");
  const [abTest, setAbTest] = useState(false);
  const [subjectB, setSubjectB] = useState("");
  const [segment, setSegment] = useState<Segment>({ preset: "all", statuses: [] });
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [localMorning, setLocalMorning] = useState(true);
  const [count, setCount] = useState<{ count: number; sample: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);
  const template = useMemo(() => templates?.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  useEffect(() => {
    if (template) {
      setSubjectA(template.subject);
      if (!name) setName(template.name ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  // Live audience size
  useEffect(() => {
    const id = setTimeout(async () => {
      const { data } = await supabase.functions.invoke("marketing-campaign", { body: { action: "count", segment, topic: template?.topic ?? "news" } });
      setCount(data?.count !== undefined ? data : null);
    }, 400);
    return () => clearTimeout(id);
  }, [segment, template]);

  const send = async () => {
    setError("");
    if (!template) return setError("Choose a template.");
    if (!subjectA.trim()) return setError("Add a subject.");
    if (abTest && !subjectB.trim()) return setError("Add subject B or turn off the A/B test.");
    if (when === "later" && !at) return setError("Choose when to send.");
    if (!confirm(`Send “${name || template.name}” to ${count?.count ?? "?"} candidates${when === "later" ? " at the scheduled time" : ""}?`)) return;
    setBusy(true);
    const { data: camp, error: e1 } = await supabase
      .from("marketing_campaigns")
      .insert({
        name: name.trim() || template.name || "Campaign",
        template_id: template.id,
        subject_a: subjectA.trim(),
        subject_b: abTest ? subjectB.trim() : null,
        topic: template.topic,
        segment,
        scheduled_at: when === "later" ? new Date(at).toISOString() : null,
        local_morning: localMorning,
      })
      .select("id")
      .single();
    if (e1 || !camp) {
      setBusy(false);
      return setError(e1?.message ?? "Could not create the campaign");
    }
    const { data, error: e2 } = await supabase.functions.invoke("marketing-campaign", { body: { action: "send", campaignId: camp.id } });
    setBusy(false);
    if (e2 || data?.error) return setError(data?.error ?? e2?.message ?? "Could not send");
    onDone(`${data.recipients} recipients · ${data.sentNow} sent now${data.scheduled ? ` · ${data.scheduled} scheduled` : ""}.`);
  };

  if (!templates) return <Spinner />;
  return (
    <Card>
      <div className="space-y-5 px-5 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">New campaign</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Template</span>
            <select className="field" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Choose…</option>
              {templates.filter((t) => !t.is_system).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Campaign name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. October intake" />
          </label>
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="label">Subject{abTest ? " A" : ""}</span>
            <input className="field" value={subjectA} onChange={(e) => setSubjectA(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand" checked={abTest} onChange={(e) => setAbTest(e.target.checked)} /> A/B test a second subject (half get each; compare opens)
          </label>
          {abTest && <input className="field" placeholder="Subject B" value={subjectB} onChange={(e) => setSubjectB(e.target.value)} />}
        </div>

        <fieldset className="space-y-2 rounded-xl bg-mist p-4">
          <legend className="flex items-center gap-1.5 text-sm font-black">
            <Users className="h-4 w-4 text-brand" /> Audience
          </legend>
          <select className="field" value={segment.preset} onChange={(e) => setSegment({ ...segment, preset: e.target.value as Segment["preset"] })}>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const on = segment.statuses?.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSegment({ ...segment, statuses: on ? segment.statuses!.filter((x) => x !== s.value) : [...(segment.statuses ?? []), s.value] })}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" placeholder="Country contains… e.g. Morocco" value={segment.country ?? ""} onChange={(e) => setSegment({ ...segment, country: e.target.value })} />
            <input className="field" placeholder="Course contains… e.g. Business" value={segment.course ?? ""} onChange={(e) => setSegment({ ...segment, course: e.target.value })} />
          </div>
          <p className="text-sm">
            <strong>{count?.count ?? "…"}</strong> candidates match
            {count?.sample.length ? <span className="text-slate-500"> — {count.sample.join(", ")}{count.count > count.sample.length ? "…" : ""}</span> : null}
            <span className="block text-xs text-slate-400">Unsubscribed people and those who opted out of this type of email are excluded automatically.</span>
          </p>
        </fieldset>

        <fieldset className="space-y-2 rounded-xl bg-mist p-4">
          <legend className="flex items-center gap-1.5 text-sm font-black">
            <CalendarClock className="h-4 w-4 text-brand" /> When
          </legend>
          <div className="flex gap-2">
            {(["now", "later"] as const).map((w) => (
              <button key={w} type="button" onClick={() => setWhen(w)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${when === w ? "bg-brand text-white" : "bg-white ring-1 ring-slate-200"}`}>
                {w === "now" ? "Send now" : "Schedule"}
              </button>
            ))}
          </div>
          {when === "later" && <input type="datetime-local" className="field w-auto" value={at} onChange={(e) => setAt(e.target.value)} />}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand" checked={localMorning} onChange={(e) => setLocalMorning(e.target.checked)} /> Deliver at 9:00 in each candidate’s own time zone
          </label>
        </fieldset>

        {template && settings && <SpamPanel subject={subjectA} blocks={template.blocks} settings={settings} />}

        <Button loading={busy} onClick={send} className="w-full">
          {when === "later" || localMorning ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {when === "later" ? "Schedule campaign" : localMorning ? "Send at each candidate's 9:00" : "Send now"}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" /> Opens, clicks and unsubscribes appear on the campaign card.
        </p>
      </div>
    </Card>
  );
}
