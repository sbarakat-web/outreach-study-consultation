import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, Play } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { callStage, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Alert, Button, Card, Spinner } from "../../components/ui";
import { bookingMessage, confirmCall, googleEventUrl, googleWeekUrl, maltaTime } from "./calls";
import { isBookedForSession, sessionHref } from "./SessionPanel";

const DAY = 86_400_000;
const CLASH_MINUTES = 20;

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

interface Event {
  c: Consultation;
  at: string;
  kind: "booked" | "requested" | "done";
}

/** Admin calendar: confirm requested calls manually against your real calendar; booked calls link to the online session. */
export function CalendarPage() {
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [error, setError] = useState("");
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .neq("call_status", "none")
      .is("call_declined_at", null)
      .order("preferred_call_at", { ascending: true });
    if (error) setError(error.message);
    setItems((data as Consultation[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmedAts = useMemo(
    () => (items ?? []).filter((c) => c.call_status === "confirmed" && c.preferred_call_at).map((c) => new Date(c.preferred_call_at!).getTime()),
    [items],
  );
  const clashes = (iso: string, selfConfirmed = false) => {
    const t = new Date(iso).getTime();
    const hits = confirmedAts.filter((x) => Math.abs(x - t) < CLASH_MINUTES * 60_000).length;
    return hits > (selfConfirmed ? 1 : 0);
  };

  const toConfirm = useMemo(
    () =>
      (items ?? [])
        .filter((c) => ["requested", "reviewed"].includes(callStage(c)) && c.requested_call_times.length)
        .sort((a, b) => a.requested_call_times[0].localeCompare(b.requested_call_times[0])),
    [items],
  );

  const events = useMemo<Event[]>(() => {
    const out: Event[] = [];
    for (const c of items ?? []) {
      if (c.call_status === "confirmed" && c.preferred_call_at) out.push({ c, at: c.preferred_call_at, kind: isBookedForSession(c) ? "booked" : "done" });
      else if (c.requested_call_times[0]) out.push({ c, at: c.requested_call_times[0], kind: "requested" });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [items]);

  const days = Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * DAY));
  const today = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const confirm = async (c: Consultation, iso: string) => {
    const { error } = await confirmCall(c, iso);
    if (error) return setError(error.message);
    setFlash(`${c.full_name} confirmed for ${maltaTime(iso)} (Malta) — now in the online-session queue.`);
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {flash && <Alert tone="success">{flash}</Alert>}

      <Card>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black">To confirm ({toConfirm.length})</h2>
              <p className="text-xs text-slate-500">
                Check your Google Calendar, add the call there, then confirm. Confirmed calls join the online-session queue.
              </p>
            </div>
            <a href={googleWeekUrl(new Date())} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open my Google Calendar
              </Button>
            </a>
          </div>
          {toConfirm.length === 0 ? (
            <p className="text-sm text-slate-500">No call requests waiting.</p>
          ) : (
            <ul className="space-y-2">
              {toConfirm.map((c) => (
                <RequestRow key={c.id} c={c} clash={clashes(c.requested_call_times[0])} onConfirm={(iso) => confirm(c, iso)} />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                aria-label="Previous week"
                onClick={() => setWeek(new Date(week.getTime() - 7 * DAY))}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-black">
                {days[0].toLocaleDateString([], { day: "numeric", month: "short" })} – {days[6].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
              </h2>
              <button
                aria-label="Next week"
                onClick={() => setWeek(new Date(week.getTime() + 7 * DAY))}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist"
              >
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
              <a href={googleWeekUrl(week)} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">
                This week in Google Calendar
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-400">Times in your time zone ({tz}).</p>

          <div className="grid gap-2 md:grid-cols-7">
            {days.map((d) => {
              const list = events.filter((e) => sameDay(new Date(e.at), d));
              const isToday = sameDay(d, today);
              return (
                <div key={d.toISOString()} className={`min-h-28 rounded-2xl p-2 ${isToday ? "bg-brand/5 ring-2 ring-brand/30" : "bg-mist"}`}>
                  <p className={`mb-2 text-xs font-black uppercase tracking-wider ${isToday ? "text-brand" : "text-slate-500"}`}>
                    {d.toLocaleDateString([], { weekday: "short", day: "numeric" })}
                  </p>
                  <ul className="space-y-1.5">
                    {list.map((e) => (
                      <EventChip key={`${e.c.id}-${e.kind}`} e={e} clash={e.kind !== "done" && clashes(e.at, e.kind === "booked")} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} /> {label}
    </span>
  );
}

function EventChip({ e, clash }: { e: Event; clash: boolean }) {
  const style = {
    booked: "border-emerald-300 bg-white",
    requested: "border-amber-300 bg-amber-50",
    done: "border-slate-200 bg-white opacity-70",
  }[e.kind];
  return (
    <li className={`rounded-xl border-l-4 px-2 py-1.5 text-xs shadow-sm ${style}`}>
      <p className="flex items-center gap-1 font-black text-navy">
        {timeOf(e.at)}
        {clash && <AlertTriangle className="h-3.5 w-3.5 text-brand-red" aria-label="Clash with another booked call" />}
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

function RequestRow({ c, clash, onConfirm }: { c: Consultation; clash: boolean; onConfirm: (iso: string) => void }) {
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const at = c.requested_call_times[0];
  return (
    <li className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/admin?lead=${c.id}`} className="font-black text-navy hover:text-brand">
            {c.full_name}
          </Link>
          <p className="text-xs text-slate-500">{c.desired_course || "No course yet"}</p>
          <p className="mt-1">
            Requested: <strong>{maltaTime(at)}</strong> <span className="text-xs text-slate-400">(Malta)</span>
            {clash && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-bold text-brand-red">
                <AlertTriangle className="h-3 w-3" /> Clashes with a booked call
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a href={googleEventUrl(c, at)} target="_blank" rel="noreferrer">
            <Button variant="ghost" className="min-h-9 px-3">
              <CalendarPlus className="h-4 w-4" /> Add to Google
            </Button>
          </a>
          <Button className="min-h-9 px-4" onClick={() => onConfirm(at)}>
            Confirm
          </Button>
          <Button variant="secondary" className="min-h-9 px-3" onClick={() => setShowOther((v) => !v)}>
            Other time
          </Button>
          {c.whatsapp && (
            <a href={waLink(c.whatsapp, bookingMessage(c))} target="_blank" rel="noreferrer" title="Send the Google booking link on WhatsApp">
              <Button variant="secondary" className="min-h-9 px-3">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>
      {showOther && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="datetime-local" aria-label="Other call time" className="field py-2" value={other} onChange={(e) => setOther(e.target.value)} />
          {other && (
            <a href={googleEventUrl(c, new Date(other).toISOString())} target="_blank" rel="noreferrer">
              <Button variant="ghost" className="min-h-10 px-3">
                <CalendarPlus className="h-4 w-4" />
              </Button>
            </a>
          )}
          <Button disabled={!other} onClick={() => onConfirm(new Date(other).toISOString())}>
            Confirm this time
          </Button>
        </div>
      )}
    </li>
  );
}
