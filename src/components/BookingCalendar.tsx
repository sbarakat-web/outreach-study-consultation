import { useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, Check, ChevronLeft, ChevronRight, Download, Info } from "lucide-react";
import { supabase } from "../lib/supabase";
import { CALL_MINUTES, callStage, callTimes, formatSlot } from "../lib/options";
import type { Consultation } from "../lib/types";
import { Alert, Button } from "./ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Local calendar day key, so times group by the candidate's own date.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const longDate = (iso: string) => formatSlot(iso, { weekday: "long", month: "long" });

/**
 * Candidate picks one preferred call time. This is a request only: an advisor
 * reviews the profile and confirms the call manually, so nothing is reserved here.
 */
export function BookingCalendar({ c, onRequested }: { c: Consultation; onRequested: () => void }) {
  const stage = callStage(c);
  const [editing, setEditing] = useState(stage === "none");
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
  const isPicked = (t: Date) => picked?.getTime() === t.getTime();

  const send = async () => {
    if (!picked) return setError("Please pick a time.");
    setError("");
    setSaving(true);
    const { error } = await supabase.rpc("request_call_times", {
      p_consultation_id: c.id,
      p_times: [picked.toISOString()],
    });
    setSaving(false);
    if (error) {
      setError(
        error.message.includes("ALREADY_CONFIRMED")
          ? "Your call is already confirmed. Contact your advisor to change it."
          : error.message.includes("INVALID_TIME")
            ? "Please pick times at least one day ahead."
            : error.message,
      );
      return;
    }
    // Instant alert to the team; best-effort.
    supabase.functions.invoke("call-request-alert", { body: { consultation_id: c.id } }).catch(() => {});
    setEditing(false);
    setPicked(null);
    onRequested();
  };

  if (!editing && stage !== "none") {
    return <CallStatus c={c} stage={stage} onChange={() => setEditing(true)} />;
  }

  const dayTimes = day ? byDay.get(day) ?? [] : [];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="rounded-2xl border-2 border-brand/20 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-black">
            <CalendarCheck className="h-5 w-5 text-brand" /> Pick a time for your free {CALL_MINUTES}-minute call
          </h3>
          <span className="text-xs text-slate-500">Your time zone: {tz}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          We’ll review your profile and confirm the call with you. We usually confirm within 24 hours.
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
                  onClick={() => setDay(k)}
                  className={`relative aspect-square rounded-xl text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    selected
                      ? "bg-brand font-black text-white"
                      : available
                        ? "bg-brand/10 font-extrabold text-navy hover:bg-brand/20"
                        : "text-slate-300"
                  }`}
                >
                  {d.getDate()}
                  {available && (
                    <span
                      className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                        picked && dayKey(picked) === k ? "h-1.5 w-1.5 bg-brand-red" : selected ? "bg-white" : "bg-brand"
                      }`}
                    />
                  )}
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
                {dayTimes.map((t) => {
                  const on = isPicked(t);
                  return (
                    <button
                      key={t.toISOString()}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setError("");
                        setPicked(on ? null : t);
                      }}
                      className={`rounded-xl border-2 py-2.5 text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 ${
                        on ? "border-brand bg-brand text-white" : "border-slate-100 bg-mist hover:border-brand/40"
                      }`}
                    >
                      {timeOf(t)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Pick a highlighted day to see the available times.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 px-4 py-4 sm:px-5">
        <p className="text-sm">
          {picked ? (
            <>
              Your time: <strong>{formatSlot(picked.toISOString(), { weekday: "long", month: "long" })}</strong>
            </>
          ) : (
            <span className="text-slate-500">Pick a day, then a time.</span>
          )}
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          {stage !== "none" && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Keep my current time
            </Button>
          )}
          <Button onClick={send} loading={saving} disabled={!picked}>
            Request this time
          </Button>
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Requested", "Profile reviewed", "Confirmed"];

function Timeline({ reached }: { reached: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Call status">
      {STEPS.map((label, i) => (
        <li key={label} className="space-y-1.5">
          <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-emerald-500" : "bg-slate-200"}`} />
          <span className={`flex items-center gap-1 text-xs font-bold ${i <= reached ? "text-navy" : "text-slate-400"}`}>
            {i <= reached && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CallStatus({ c, stage, onChange }: { c: Consultation; stage: ReturnType<typeof callStage>; onChange: () => void }) {
  if (stage === "declined") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-mist px-4 py-4 sm:px-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <p className="text-sm text-slate-600">
          Thank you for your interest. Your advisor will contact you about the best next step for your profile.
        </p>
      </div>
    );
  }

  if (stage === "confirmed" && c.preferred_call_at) {
    return (
      <div className="space-y-4 rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200 sm:px-5">
        <Timeline reached={2} />
        <ConfirmedCall at={c.preferred_call_at} course={c.desired_course || "your studies"} />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-amber-50 px-4 py-4 ring-1 ring-amber-200 sm:px-5">
      <Timeline reached={stage === "reviewed" ? 1 : 0} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            {stage === "reviewed" ? "Profile reviewed · confirming your time" : "Requested · pending review"}
          </p>
          {c.requested_call_times[0] && (
            <p className="mt-1 text-sm">
              <span className="text-slate-500">Requested time:</span> <strong>{longDate(c.requested_call_times[0])}</strong>
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">We usually confirm within 24 hours, on WhatsApp or by email.</p>
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
    <div>
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Your free call is confirmed</p>
          <p className="text-lg font-black">{longDate(at)}</p>
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
