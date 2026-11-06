import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, CalendarX2, Check, ChevronLeft, ChevronRight, Download, Info, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CALL_MINUTES, callStage, formatSlot } from "../lib/options";
import { useFreeTimes } from "../lib/freeTimes";
import type { Consultation } from "../lib/types";
import { Alert, Button } from "./ui";
import { currentLocale, useI18n } from "../lib/i18n";
import { AttendBox } from "../pages/ConfirmCall";


// Local calendar day key, so times group by the candidate's own date.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const timeOf = (d: Date) => d.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });
const dayLabel = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(currentLocale(), opts);
// Monday-first weekday names in the current language (2024-01-01 was a Monday).
const weekdays = () => Array.from({ length: 7 }, (_, i) => dayLabel(new Date(2024, 0, 1 + i), { weekday: "short" }));
const longDate = (iso: string) => formatSlot(iso, { weekday: "long", month: "long" });

/**
 * Candidate picks a free call time (the adviser's Google Calendar, same slots as the booking page). It is held as
 * "Awaiting confirmation"; the team confirms it and the candidate gets the Google Meet link by email.
 */
export function BookingCalendar({ c, onRequested }: { c: Consultation; onRequested: () => void }) {
  const { t } = useI18n();
  const stage = callStage(c);
  // A cancelled call may still have call_reviewed_at from its earlier workflow. Treat it as a fresh booking choice.
  const cancelled = !!c.tracking?.appointment_cancelled_at && c.call_status === "none";
  const [editing, setEditing] = useState(stage === "none" || cancelled);
  // Only offer free times: other candidates' confirmed calls and the adviser's Google busy times.
  const { times } = useFreeTimes();
  const [month, setMonth] = useState(() => monthStart(times[0] ?? new Date()));
  const [day, setDay] = useState<string | null>(() => (times[0] ? dayKey(times[0]) : null));
  const [picked, setPicked] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Also switch an already-open dashboard to the rebooking calendar when cancellation arrives via realtime refresh.
  useEffect(() => {
    if (cancelled) setEditing(true);
  }, [cancelled]);

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
    if (!picked) return setError(t("cal.errPick"));
    setError("");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("book-call", { body: { consultationId: c.id, at: picked.toISOString() } });
    setSaving(false);
    const code = data?.error ?? (error ? "failed" : null);
    if (code) {
      setError(
        code === "taken" ? t("cal.errTaken") : code === "too-late" ? t("cal.errConfirmed") : code === "invalid-time" ? t("cal.errTime") : t("cal.errFailed"),
      );
      return;
    }
    setEditing(false);
    setPicked(null);
    onRequested();
  };

  if (!editing && stage !== "none") {
    return <CallStatus c={c} stage={stage} onChange={() => setEditing(true)} onReload={onRequested} />;
  }

  const dayTimes = day ? byDay.get(day) ?? [] : [];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-4">
      {cancelled && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-4 ring-1 ring-red-200 sm:px-5">
          <CalendarX2 className="mt-0.5 h-6 w-6 shrink-0 text-brand-red" />
          <div>
            <p className="font-black text-brand-red">{t("call.cancelledTitle")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("call.cancelledText")}</p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border-2 border-brand/20 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-black">
            <CalendarCheck className="h-5 w-5 text-brand" /> {t("cal.title", { min: CALL_MINUTES })}
          </h3>
          <span className="text-xs text-slate-500">{t("cal.tz", { tz })}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {t("cal.sub")}
        </p>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1fr_14rem]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={t("cal.prev")}
              disabled={month <= firstMonth}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <p className="font-extrabold">{dayLabel(month, { month: "long", year: "numeric" })}</p>
            <button
              type="button"
              aria-label={t("cal.next")}
              disabled={month >= lastMonth}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-mist disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays().map((w) => (
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
                  aria-label={`${dayLabel(d, { weekday: "long", day: "numeric", month: "long" })}${available ? "" : `, ${t("cal.notAvailable")}`}`}
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
                {dayLabel(dayTimes[0], { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pe-1 md:grid-cols-2">
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
            <p className="text-sm text-slate-500">{t("cal.pickDay")}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 px-4 py-4 sm:px-5">
        <p className="text-sm">
          {picked ? (
            <>
              {t("cal.yourTime")} <strong>{formatSlot(picked.toISOString(), { weekday: "long", month: "long" })}</strong>
            </>
          ) : (
            <span className="text-slate-500">{t("cal.pickPrompt")}</span>
          )}
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          {stage !== "none" && !cancelled && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t("cal.keep")}
            </Button>
          )}
          <Button onClick={send} loading={saving} disabled={!picked}>
            {t("cal.request")}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function Timeline({ reached }: { reached: number }) {
  const { t } = useI18n();
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={t("tl.label")}>
      {[t("tl.requested"), t("tl.reviewed"), t("tl.confirmed")].map((label, i) => (
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

function CallStatus({ c, stage, onChange, onReload }: { c: Consultation; stage: ReturnType<typeof callStage>; onChange: () => void; onReload: () => void }) {
  const { t } = useI18n();
  if (stage === "declined") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-mist px-4 py-4 sm:px-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <p className="text-sm text-slate-600">
          {t("call.declined")}
        </p>
      </div>
    );
  }

  if (stage === "confirmed" && c.preferred_call_at) {
    return (
      <div className="space-y-4 rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200 sm:px-5">
        <Timeline reached={2} />
        <ConfirmedCall c={c} at={c.preferred_call_at} course={c.desired_course || "your studies"} meetUrl={c.meeting_url} onChanged={onReload} />
        {c.call_confirm_token && new Date(c.preferred_call_at).getTime() > Date.now() + 12 * 3_600_000 && (
          <Link to={`/confirm-call?t=${c.call_confirm_token}&pick=1`} className="inline-block text-sm font-bold text-brand hover:underline">
            {t("confirm.change")}
          </Link>
        )}
      </div>
    );
  }

  if (stage === "suggested" && c.suggested_call_at) {
    return (
      <div className="space-y-4 rounded-2xl bg-brand/5 px-4 py-4 ring-1 ring-brand/20 sm:px-5">
        <Timeline reached={1} />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand">{t("call.suggestedTitle")}</p>
          <p className="mt-1 text-sm text-slate-600">{t("call.suggestedText")}</p>
          <p className="mt-1 text-lg font-black text-navy">{longDate(c.suggested_call_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.call_confirm_token && (
            <Link to={`/confirm-call?t=${c.call_confirm_token}`}>
              <Button>{t("call.confirmBtn")}</Button>
            </Link>
          )}
          {c.call_confirm_token ? (
            <Link to={`/confirm-call?t=${c.call_confirm_token}&pick=1`}>
              <Button variant="ghost">{t("call.otherTime")}</Button>
            </Link>
          ) : (
            <Button variant="ghost" onClick={onChange}>
              {t("call.otherTime")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-amber-50 px-4 py-4 ring-1 ring-amber-200 sm:px-5">
      <Timeline reached={stage === "reviewed" ? 1 : 0} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            {stage === "reviewed" ? t("call.reviewedTitle") : t("call.pendingTitle")}
          </p>
          {c.requested_call_times[0] && (
            <p className="mt-1 text-sm">
              <span className="text-slate-500">{t("call.requestedTime")}</span> <strong>{longDate(c.requested_call_times[0])}</strong>
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">{t("call.usually")}</p>
        </div>
        <Button variant="ghost" onClick={onChange}>
          {t("call.change")}
        </Button>
      </div>
    </div>
  );
}

/** "2 days 4 hours" / "3 hours 12 min" / "8 min" until the call. */
function untilText(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return `${d} day${d > 1 ? "s" : ""}${h ? ` ${h} hour${h > 1 ? "s" : ""}` : ""}`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}${m ? ` ${m} min` : ""}`;
  return `${m} min`;
}

function ConfirmedCall({ c, at, course, meetUrl, onChanged }: { c: Consultation; at: string; course: string; meetUrl?: string | null; onChanged: () => void }) {
  const { t } = useI18n();
  const [attending, setAttending] = useState(false);
  const attend = async () => {
    setAttending(true);
    await supabase.functions.invoke("book-call", { body: { consultationId: c.id, attend: true } });
    setAttending(false);
    onChanged();
  };
  const malta = formatSlot(at, { weekday: "long", month: "long", timeZone: "Europe/Malta" });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const start = new Date(at);
  const toStart = start.getTime() - now;
  // Join opens 10 minutes before the call and stays open during it.
  const live = toStart <= 10 * 60_000 && toStart > -CALL_MINUTES * 60_000;
  const end = new Date(start.getTime() + CALL_MINUTES * 60000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = "Free call with Outreach";
  const details = `Your free consultation about ${course}.${meetUrl ? ` Join on Google Meet: ${meetUrl}` : ""}`;

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
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{t("call.confirmedTitle")}</p>
          <p className="text-lg font-black">{longDate(at)}</p>
          {malta !== longDate(at) && <p className="text-xs font-bold text-slate-500">🇲🇹 {t("call.malta", { when: malta })}</p>}
          <p className="text-sm text-slate-600">{t("call.confirmedSub", { min: CALL_MINUTES })}</p>
        </div>
      </div>
      {!c.attendance_confirmed_at && c.attendance_deadline && toStart > 0 && (
        <div className="mt-3">
          <AttendBox by={longDate(c.attendance_deadline)} saving={attending} onAttend={attend} />
        </div>
      )}
      {c.attendance_confirmed_at && toStart > 0 && <p className="mt-3 text-sm font-bold text-emerald-700">✓ {t("attend.done")}</p>}
      {toStart > -CALL_MINUTES * 60_000 && (
        <p className={`mt-3 text-sm font-black ${live ? "text-emerald-700" : "text-navy"}`}>
          {live ? t("call.live") : t("call.countdown", { t: untilText(toStart) })}
        </p>
      )}
      {meetUrl && (
        <div className="mt-2 space-y-1">
          <a
            href={meetUrl}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-extrabold transition ${
              live ? "animate-pulse bg-emerald-600 text-white shadow-lg hover:bg-emerald-700" : "bg-white text-navy ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            <Video className="h-4 w-4" /> {t("call.join")}
          </a>
          <p className="text-xs text-slate-500">{t("call.invite")}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={google}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <CalendarPlus className="h-4 w-4" /> {t("call.google")}
        </a>
        <button
          type="button"
          onClick={downloadIcs}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> {t("call.ics")}
        </button>
      </div>
    </div>
  );
}
