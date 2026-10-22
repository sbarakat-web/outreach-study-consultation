import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Link2,
  Play,
  Printer,
  RefreshCcw,
  Send,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { callStage } from "../../lib/options";
import type { Consultation, Task } from "../../lib/types";
import { Alert, Button, Card, Spinner } from "../../components/ui";
import {
  confirmAndNotify,
  fillTab,
  googleApi,
  googleWeekUrl,
  maltaTime,
  notifyCandidate,
  suggestTime,
} from "./calls";
import { isBookedForSession, sessionHref } from "./SessionPanel";

const DAY = 86_400_000;
const CLASH_MINUTES = 20;
const OVERDUE_HOURS = 2;

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
// Time waiting on someone: the one sent to the candidate, else the one they asked for.
const pendingAt = (c: Consultation) => c.suggested_call_at ?? c.requested_call_times[0] ?? null;
const sourceOf = (c: Consultation) => c.tracking?.utm_source || (c.tracking?.ref ? "referral" : "direct");

type Kind = "booked" | "requested" | "done";
interface Event {
  c: Consultation;
  at: string;
  kind: Kind;
}
interface Busy {
  start: string;
  end: string;
}

/** Admin calendar: confirm calls against your real calendar; booked calls link to the online session. */
export function CalendarPage() {
  const { session } = useAuth();
  const me = session?.user.email?.toLowerCase() ?? "";
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [google, setGoogle] = useState<{ configured: boolean; connections: { email: string; is_default: boolean }[] }>({ configured: false, connections: [] });
  const [busy, setBusy] = useState<Busy[]>([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(params.get("google") === "connected" ? "Google Calendar connected." : "");
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [source, setSource] = useState("all");
  const [agendaDay, setAgendaDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [working, setWorking] = useState<string | null>(null);

  const myConnection = google.connections.find((g) => g.email === me);
  const googleReady = google.configured && google.connections.length > 0;

  const load = useCallback(async () => {
    const [list, t] = await Promise.all([
      supabase.from("consultations").select("*").or("call_status.neq.none,session_outcome.eq.no_attendance").order("preferred_call_at", { ascending: true }),
      supabase.from("tasks").select("*").is("done_at", null).order("due_at"),
    ]);
    if (list.error) setError(list.error.message);
    setItems(((list.data as Consultation[]) ?? []).filter((c) => !c.call_declined_at));
    setTasks((t.data as Task[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    googleApi("status").then((r) => setGoogle({ configured: !r.error && !r.data?.error, connections: r.data?.connections ?? [] }));
    if (params.get("google")) setParams({}, { replace: true });
  }, [load]);

  // Google busy blocks for the visible week.
  useEffect(() => {
    if (!googleReady) return;
    googleApi("busy", { from: week.toISOString(), to: new Date(week.getTime() + 7 * DAY).toISOString(), email: me }).then((r) =>
      setBusy(r.data?.busy ?? []),
    );
  }, [googleReady, week, me]);

  const byId = useMemo(() => new Map((items ?? []).map((c) => [c.id, c])), [items]);
  const confirmedAts = useMemo(
    () => (items ?? []).filter((c) => c.call_status === "confirmed" && c.preferred_call_at).map((c) => new Date(c.preferred_call_at!).getTime()),
    [items],
  );
  const clashes = (iso: string, self = false) => {
    const t = new Date(iso).getTime();
    const booked = confirmedAts.filter((x) => Math.abs(x - t) < CLASH_MINUTES * 60_000).length > (self ? 1 : 0);
    const googleBusy = busy.some((b) => t >= new Date(b.start).getTime() && t < new Date(b.end).getTime());
    return booked || (!self && googleBusy);
  };

  const matches = (c: Consultation) =>
    source === "all" || sourceOf(c) === source;

  const toConfirm = useMemo(
    () =>
      (items ?? [])
        .filter((c) => matches(c) && ["requested", "reviewed", "suggested"].includes(callStage(c)) && pendingAt(c))
        .sort((a, b) => pendingAt(a)!.localeCompare(pendingAt(b)!)),
    [items, source],
  );
  const rebook = (items ?? []).filter((c) => matches(c) && c.session_outcome === "no_attendance" && c.call_status === "none");
  const overdue = (items ?? []).filter(
    (c) => matches(c) && isBookedForSession(c) && c.preferred_call_at && new Date(c.preferred_call_at).getTime() < Date.now() - OVERDUE_HOURS * 3_600_000,
  );

  const events = useMemo<Event[]>(() => {
    const out: Event[] = [];
    for (const c of items ?? []) {
      if (!matches(c)) continue;
      if (c.call_status === "confirmed" && c.preferred_call_at) out.push({ c, at: c.preferred_call_at, kind: isBookedForSession(c) ? "booked" : "done" });
      else if (c.call_status !== "none" && pendingAt(c)) out.push({ c, at: pendingAt(c)!, kind: "requested" });
    }
    return out.filter((e) => kindFilter === "all" || e.kind === kindFilter).sort((a, b) => a.at.localeCompare(b.at));
  }, [items, source, kindFilter]);

  const sources = useMemo(() => [...new Set((items ?? []).map(sourceOf))].sort(), [items]);
  const days = Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * DAY));
  const today = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ------------------------------------------------------------ actions
  const confirm = async (c: Consultation, iso: string) => {
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setWorking(c.id);
    const r = await confirmAndNotify(c, iso, { google: googleReady, waTab });
    setWorking(null);
    if (r.error) return setError(r.error);
    setFlash(
      `${c.full_name} confirmed for ${maltaTime(iso)} (Malta)${r.meetUrl ? " · Meet link created" : ""}${r.emailed ? " · email sent" : " · email not sent (check Resend)"}${
        r.googleError ? ` · Google: ${r.googleError}` : ""
      }. Now in the online-session queue.`,
    );
    load();
  };

  const suggest = async (c: Consultation, iso: string) => {
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setWorking(c.id);
    const r = await suggestTime(c, iso, waTab);
    setWorking(null);
    if (r.error) return setError(r.error);
    setFlash(`${maltaTime(iso)} (Malta) sent to ${c.full_name}${r.emailed ? " by email" : ""}${waTab ? " + WhatsApp" : ""}. Waiting for their confirmation.`);
    load();
  };

  const onDrop = (e: DragEvent, day: Date) => {
    e.preventDefault();
    const c = byId.get(e.dataTransfer.getData("text/plain"));
    if (!c?.preferred_call_at) return;
    const old = new Date(c.preferred_call_at);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), old.getHours(), old.getMinutes());
    if (sameDay(old, next)) return;
    if (!confirm_(`Move ${c.full_name}'s call to ${maltaTime(next.toISOString())} (Malta)? The candidate is emailed the new time.`)) return;
    confirm(c, next.toISOString());
  };

  const completeTask = async (t: Task) => {
    await supabase.from("tasks").update({ done_at: new Date().toISOString() }).eq("id", t.id);
    load();
  };

  const resendRebook = async (c: Consultation) => {
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    const r = await notifyCandidate("rebook", c.id);
    fillTab(waTab, r.data?.waUrl);
    setFlash(r.data?.ok ? `Rebooking email sent to ${c.full_name}.` : `Rebooking email not sent — check Resend.`);
  };

  const connectGoogle = async () => {
    const r = await googleApi("auth-url");
    if (r.data?.url) window.location.href = r.data.url;
    else setError(r.data?.error ?? "Google is not set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase.");
  };

  // ------------------------------------------------------------ agenda
  const agenda = useMemo(() => {
    const d = new Date(`${agendaDay}T00:00`);
    return events.filter((e) => e.kind !== "requested" && sameDay(new Date(e.at), d));
  }, [events, agendaDay]);

  const agendaRows = agenda.map((e) => [timeOf(e.at), e.c.full_name, e.c.email, e.c.whatsapp ?? "", e.c.desired_course ?? "", e.c.meeting_url ?? "", e.kind]);
  const AGENDA_HEAD = ["Time", "Candidate", "Email", "WhatsApp", "Course", "Meet", "Status"];

  const exportCsv = () => {
    const csv = [AGENDA_HEAD, ...agendaRows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-agenda-${agendaDay}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printAgenda = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
    w.document.write(`<!doctype html><title>Agenda ${agendaDay}</title><style>body{font-family:Arial;padding:24px;color:#14123a}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#442DFA;color:#fff}</style>
      <h2>Outreach — agenda for ${new Date(`${agendaDay}T00:00`).toLocaleDateString([], { dateStyle: "full" })}</h2>
      <table><tr>${AGENDA_HEAD.map((h) => `<th>${h}</th>`).join("")}</tr>${agendaRows.map((r) => `<tr>${r.map((v) => `<td>${esc(String(v))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="7">No calls.</td></tr>`}</table>
      <script>window.print()</script>`);
    w.document.close();
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {flash && <Alert tone="success">{flash}</Alert>}

      {/* Google connection */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3 text-sm shadow-sm ring-1 ring-slate-200">
        {!google.configured ? (
          <p className="text-slate-600">
            <strong>Google Calendar not set up.</strong> Add the Google OAuth keys in Supabase to show your busy times and create Meet links automatically.
          </p>
        ) : myConnection ? (
          <p className="flex items-center gap-2 text-slate-600">
            <Check className="h-4 w-4 text-emerald-600" /> Google Calendar connected: <strong>{me}</strong>
            {myConnection.is_default && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">default for candidates</span>}
          </p>
        ) : (
          <p className="text-slate-600">Connect your Google Calendar to see busy times and create Meet links on confirm.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {google.configured && !myConnection && (
            <Button onClick={connectGoogle}>
              <Link2 className="h-4 w-4" /> Connect Google Calendar
            </Button>
          )}
          {myConnection && (
            <Button variant="ghost" onClick={() => googleApi("disconnect").then(() => googleApi("status").then((r) => setGoogle({ configured: true, connections: r.data?.connections ?? [] })))}>
              Disconnect
            </Button>
          )}
          <a href={googleWeekUrl(week)} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-4 w-4" /> Open Google Calendar
            </Button>
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className="field w-auto py-2" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | Kind)} aria-label="Status">
          <option value="all">All calls</option>
          <option value="booked">Booked</option>
          <option value="requested">Requested</option>
          <option value="done">Session done</option>
        </select>
        <select className="field w-auto py-2" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {overdue.length > 0 && (
        <div className="rounded-2xl border-2 border-brand-red/30 bg-brand-red/5 px-5 py-4 text-sm">
          <p className="flex items-center gap-2 font-black text-brand-red">
            <AlertTriangle className="h-4 w-4" /> {overdue.length} call{overdue.length > 1 ? "s" : ""} not completed {OVERDUE_HOURS}+ hours after the start time
          </p>
          <ul className="mt-2 space-y-1.5">
            {overdue.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <strong>{c.full_name}</strong> <span className="text-slate-500">{maltaTime(c.preferred_call_at!)}</span>
                <Link to={sessionHref(c)} className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
                  Record outcome
                </Link>
                <Link to={`/admin?lead=${c.id}`} className="text-xs font-bold text-brand hover:underline">
                  Open lead
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* To confirm */}
      <Card>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          <div>
            <h2 className="text-lg font-black">To confirm ({toConfirm.length})</h2>
            <p className="text-xs text-slate-500">
              Send the time by email + WhatsApp; the candidate confirms with one click and you get an email. If they reply YES on WhatsApp, use “Mark confirmed”.
            </p>
          </div>
          {toConfirm.length === 0 ? (
            <p className="text-sm text-slate-500">No call requests waiting.</p>
          ) : (
            <ul className="space-y-2">
              {toConfirm.map((c) => (
                <RequestRow
                  key={c.id}
                  c={c}
                  google={googleReady}
                  busy={working === c.id}
                  clash={clashes(pendingAt(c)!)}
                  onConfirm={(iso) => confirm(c, iso)}
                  onSuggest={(iso) => suggest(c, iso)}
                />
              ))}
            </ul>
          )}
        </div>
      </Card>

      {rebook.length > 0 && (
        <Card>
          <div className="space-y-3 px-5 py-5 sm:px-7">
            <h2 className="text-lg font-black">Rebook requested ({rebook.length})</h2>
            <p className="text-xs text-slate-500">Missed their call. They were asked to pick a new time; new requests appear under "To confirm".</p>
            <ul className="space-y-1.5 text-sm">
              {rebook.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin?lead=${c.id}`} className="font-bold hover:text-brand">
                    {c.full_name}
                  </Link>
                  <span className="text-xs text-slate-500">missed {c.session_outcome_at ? new Date(c.session_outcome_at).toLocaleDateString() : ""}</span>
                  <button onClick={() => resendRebook(c)} className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                    <RefreshCcw className="h-3 w-3" /> Send again
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Week */}
      <Card>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button aria-label="Previous week" onClick={() => setWeek(new Date(week.getTime() - 7 * DAY))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-black">
                {days[0].toLocaleDateString([], { day: "numeric", month: "short" })} – {days[6].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
              </h2>
              <button aria-label="Next week" onClick={() => setWeek(new Date(week.getTime() + 7 * DAY))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist">
                <ChevronRight className="h-5 w-5" />
              </button>
              <button onClick={() => setWeek(startOfWeek(new Date()))} className="ml-1 rounded-full px-3 py-1 text-xs font-bold text-brand hover:bg-brand/5">
                Today
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <Legend className="bg-emerald-500" label="Booked" />
              <Legend className="bg-amber-400" label="Requested" />
              <Legend className="bg-slate-300" label="Session done" />
              <Legend className="bg-violet-500" label="Task" />
              {googleReady && <Legend className="bg-slate-500" label="Busy (Google)" />}
            </div>
          </div>
          <p className="text-xs text-slate-400">Times in your time zone ({tz}). Drag a booked call to another day to reschedule (same time).</p>

          <div className="grid gap-2 md:grid-cols-7">
            {days.map((d) => {
              const list = events.filter((e) => sameDay(new Date(e.at), d));
              const dayTasks = tasks.filter((t) => sameDay(new Date(t.due_at), d) && (!byId.get(t.consultation_id) || matches(byId.get(t.consultation_id)!)));
              const dayBusy = busy.filter((b) => sameDay(new Date(b.start), d));
              const isToday = sameDay(d, today);
              return (
                <div
                  key={d.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, d)}
                  className={`min-h-32 rounded-2xl p-2 ${isToday ? "bg-brand/5 ring-2 ring-brand/30" : "bg-mist"}`}
                >
                  <p className={`mb-2 text-xs font-black uppercase tracking-wider ${isToday ? "text-brand" : "text-slate-500"}`}>
                    {d.toLocaleDateString([], { weekday: "short", day: "numeric" })}
                  </p>
                  <ul className="space-y-1.5">
                    {dayBusy.map((b, i) => (
                      <li key={`busy-${i}`} className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">
                        {timeOf(b.start)}–{timeOf(b.end)} · Busy
                      </li>
                    ))}
                    {list.map((e) => (
                      <EventChip key={`${e.c.id}-${e.kind}`} e={e} clash={e.kind !== "done" && clashes(e.at, e.kind === "booked")} />
                    ))}
                    {dayTasks.map((t) => (
                      <li key={t.id} className="rounded-lg border-l-4 border-violet-400 bg-white px-2 py-1 text-[11px] shadow-sm">
                        <label className="flex items-start gap-1.5">
                          <input type="checkbox" className="mt-0.5 accent-brand" onChange={() => completeTask(t)} aria-label={`Mark "${t.title}" done`} />
                          <span>
                            <span className="font-bold">{t.title}</span>
                            {byId.get(t.consultation_id) && <span className="block text-slate-500">{byId.get(t.consultation_id)!.full_name}</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Daily agenda */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-5 sm:px-7">
          <div>
            <h2 className="text-lg font-black">Daily agenda</h2>
            <p className="text-xs text-slate-500">
              {agenda.length} call{agenda.length === 1 ? "" : "s"} with the current filters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="date" aria-label="Agenda day" className="field w-auto py-2" value={agendaDay} onChange={(e) => setAgendaDay(e.target.value)} />
            <Button variant="secondary" onClick={printAgenda}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// window.confirm, named so it doesn't clash with the confirm action above.
const confirm_ = (msg: string) => window.confirm(msg);

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} /> {label}
    </span>
  );
}

function EventChip({ e, clash }: { e: Event; clash: boolean }) {
  const style = {
    booked: "border-emerald-400 bg-white cursor-grab",
    requested: "border-amber-300 bg-amber-50",
    done: "border-slate-200 bg-white opacity-70",
  }[e.kind];
  return (
    <li
      draggable={e.kind === "booked"}
      onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.c.id)}
      className={`rounded-xl border-l-4 px-2 py-1.5 text-xs shadow-sm ${style}`}
    >
      <p className="flex items-center justify-between gap-1 font-black text-navy">
        <span className="flex items-center gap-1">
          {timeOf(e.at)}
          {clash && <AlertTriangle className="h-3.5 w-3.5 text-brand-red" aria-label="Clash" />}
        </span>
      </p>
      <Link to={`/admin?lead=${e.c.id}`} className="block truncate font-semibold text-slate-700 hover:text-brand">
        {e.c.full_name}
      </Link>
      {e.kind === "booked" && (
        <Link to={sessionHref(e.c)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white hover:bg-brand/90">
          <Play className="h-2.5 w-2.5 fill-current" /> Start session
        </Link>
      )}
      {e.kind === "done" && e.c.session_outcome && <p className="text-[10px] font-bold text-slate-500">{e.c.session_outcome.replace(/_/g, " ")}</p>}
      {e.kind === "requested" && <p className="text-[10px] font-bold text-amber-700">To confirm</p>}
    </li>
  );
}

function RequestRow({
  c,
  google,
  busy,
  clash,
  onConfirm,
  onSuggest,
}: {
  c: Consultation;
  google: boolean;
  busy: boolean;
  clash: boolean;
  onConfirm: (iso: string) => void;
  onSuggest: (iso: string) => void;
}) {
  const waiting = !!c.suggested_call_at;
  const at = pendingAt(c)!;
  return (
    <li className={`rounded-2xl border px-4 py-3 text-sm ${waiting ? "border-sky-200 bg-sky-50/50" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/admin?lead=${c.id}`} className="font-black text-navy hover:text-brand">
            {c.full_name}
          </Link>
          {c.session_outcome === "no_attendance" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Rebook</span>}
          {waiting && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">Waiting for candidate</span>}
          <p className="text-xs text-slate-500">
            {c.desired_course || "No course yet"} · {sourceOf(c)}
          </p>
          <p className="mt-1">
            {waiting ? "Sent:" : "Asked for:"} <strong>{maltaTime(at)}</strong> <span className="text-xs text-slate-400">(Malta)</span>
            {clash && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-bold text-brand-red">
                <AlertTriangle className="h-3 w-3" /> Clash / busy
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {waiting ? (
            <>
              <Button variant="secondary" className="min-h-9 px-3" loading={busy} onClick={() => onSuggest(at)} title="Send the same time again">
                <Send className="h-4 w-4" /> Resend
              </Button>
              <Button className="min-h-9 px-4" loading={busy} onClick={() => onConfirm(at)}>
                {google ? "Mark confirmed + Meet" : "Mark confirmed"}
              </Button>
            </>
          ) : (
            <Button className="min-h-9 px-4" loading={busy} onClick={() => onSuggest(at)}>
              <Send className="h-4 w-4" /> Send for confirmation
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
