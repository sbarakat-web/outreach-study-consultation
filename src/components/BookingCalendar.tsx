import { useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Clock, Download, Hourglass } from "lucide-react";
import { supabase } from "../lib/supabase";
import { callTimes, formatSlot } from "../lib/options";
import { Alert, Button } from "./ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALL_MINUTES = 30;

// Local calendar day key, so times group by the candidate's own date.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Candidate picks a preferred call time. This is a request only: an advisor reviews
 * the profile and confirms the call manually, so nothing is reserved here.
 */
export function BookingCalendar({
  consultationId,
  course,
  requestedAt,
  callStatus,
  onRequested,
}: {
  consultationId: string;
  course: string;
  requestedAt: string | null;
  callStatus: "none" | "requested" | "confirmed";
  onRequested: () => void;
}) {
  const [editing, setEditing] = useState(callStatus === "none");
  const times = useMemo(() => callTimes(), []);
  const [month, setMonth] = useState(() => monthStart(times[0] ?? new Date()));
  const [day, setDay] = useState<string | null>(() => (times[0] ? dayKey(times[0]) : null));
  const [picked, setPicked] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const t of times) {
      const k = dayKey(t);
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return map;
  }, [times]);

  const cells = useMemo(() => {
    const offset = (month.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const firstMonth = times[0] ? monthStart(times[0]) : month;
  const lastMonth = times.length ? monthStart(times[times.length - 1]) : month;

  const request = async () => {
    if (!picked) return;
    setError("");
    setSaving(true);
    const { error } = await supabase.rpc("request_call", { p_consultation_id: consultationId, p_at: picked.toISOString() });
    setSaving(false);
    if (error) {
      setError(
        error.message.includes("ALREADY_CONFIRMED")
          ? "Your call is already confirmed. Contact your advisor to change it."
          : error.message.includes("INVALID_TIME")
            ? "Please pick a time at least one day ahead."
            : error.message,
      );
      return;
    }
    setEditing(false);
    setPicked(null);
    onRequested();
  };

  if (requestedAt && !editing) {
    return callStatus === "confirmed" ? (
      <ConfirmedCall at={requestedAt} course={course} />
    ) : (
      <RequestedCall at={requestedAt} onChange={() => setEditing(true)} />
    );
  }

  const dayTimes = day ? byDay.get(day) ?? [] : [];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="rounded-2xl border-2 border-brand-blue/20 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-black">
            <CalendarCheck className="h-5 w-5 text-brand-blue" /> Choose a preferred time for your free call
          </h3>
          <span className="text-xs text-slate-500">Your time zone: {tz}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          We’ll review your profile first, then confirm the call with you on WhatsApp or by email.
        </p>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1fr_14rem]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={month <= firstMonth}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="font-extrabold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= lastMonth}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-bold uppercase text-slate-400">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} />;
              const k = dayKey(d);
              const available = byDay.has(k);
              const selected = k === day;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!available}
                  aria-pressed={selected}
                  aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${available ? "" : ", not available"}`}
                  onClick={() => {
                    setDay(k);
                    setPicked(null);
                  }}
                  className={`relative aspect-square rounded-xl text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                    selected
                      ? "bg-navy font-black text-white"
                      : available
                        ? "bg-brand-blue/10 font-extrabold text-navy hover:bg-brand-blue/20"
                        : "text-slate-300"
                  }`}
                >
                  {d.getDate()}
                  {available && !selected && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-blue" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {dayTimes.length > 0 ? (
            <>
              <p className="mb-2 text-sm font-extrabold">
                {dayTimes[0].toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {dayTimes.map((t) => (
                  <button
                    key={t.toISOString()}
                    type="button"
                    aria-pressed={picked?.getTime() === t.getTime()}
                    onClick={() => setPicked(t)}
                    className={`rounded-xl border-2 py-2.5 text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                      picked?.getTime() === t.getTime()
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-slate-100 bg-mist hover:border-brand-blue/40"
                    }`}
                  >
                    {timeOf(t)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Pick a highlighted day to see the available times.</p>
          )}
        </div>
      </div>

      {(picked || error || requestedAt) && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 sm:px-5">
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {picked ? (
              <p className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-brand-blue" />
                <strong>{formatSlot(picked.toISOString(), { weekday: "long", month: "long" })}</strong>
              </p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {requestedAt && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Keep my request
                </Button>
              )}
              {picked && (
                <Button onClick={request} loading={saving}>
                  Request this time
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestedCall({ at, onChange }: { at: string; onChange: () => void }) {
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-4 ring-1 ring-amber-200 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Hourglass className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Requested · pending review</p>
            <p className="text-lg font-black">{formatSlot(at, { weekday: "long", month: "long" })}</p>
            <p className="text-sm text-slate-600">
              We’re reviewing your profile and will confirm your call with you on WhatsApp or by email.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onChange}>
          Change time
        </Button>
      </div>
    </div>
  );
}

function ConfirmedCall({ at, course }: { at: string; course: string }) {
  const start = new Date(at);
  const end = new Date(start.getTime() + CALL_MINUTES * 60000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = "Free call with Outreach";
  const details = `Your free consultation about ${course}. Your advisor will call you on WhatsApp.`;

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}&details=${encodeURIComponent(details)}`;

  const downloadIcs = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Outreach//Consultation//EN",
      "BEGIN:VEVENT",
      `UID:${stamp(start)}-${encodeURIComponent(course)}@consultation.outreachstudy.eu`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${details}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${title}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "outreach-call.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200 sm:px-5">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Your free call is confirmed</p>
          <p className="text-lg font-black">{formatSlot(at, { weekday: "long", month: "long" })}</p>
          <p className="text-sm text-slate-600">{CALL_MINUTES} minutes · your advisor will call you on WhatsApp</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={google}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <CalendarPlus className="h-4 w-4" /> Add to Google Calendar
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Apple / Outlook (.ics)
        </button>
      </div>
    </div>
  );
}
