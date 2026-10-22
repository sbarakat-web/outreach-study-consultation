import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatSlot } from "../lib/options";
import type { BookedSlot, Slot } from "../lib/types";
import { Alert, Button, Spinner } from "./ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Local calendar day key, so slots group by the candidate's own date.
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Candidate booking calendar: month view with available days, time list, confirm.
 * Shows the booked call (with add-to-calendar links) once there is one.
 */
export function BookingCalendar({
  consultationId,
  course,
  slot,
  onBooked,
}: {
  consultationId: string;
  course: string;
  slot: BookedSlot | undefined;
  onBooked: () => void;
}) {
  const [editing, setEditing] = useState(!slot);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("slots")
      .select("id, starts_at, duration_minutes, consultation_id")
      .is("consultation_id", null)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(500);
    if (error) setError(error.message);
    setSlots(data ?? []);
  };

  useEffect(() => {
    if (editing) load();
  }, [editing]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const k = dayKey(new Date(s.starts_at));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [slots]);

  // Jump to the first available day once slots are loaded.
  useEffect(() => {
    if (!slots?.length || day) return;
    const first = new Date(slots[0].starts_at);
    setMonth(monthStart(first));
    setDay(dayKey(first));
  }, [slots, day]);

  const lastMonth = slots?.length ? monthStart(new Date(slots[slots.length - 1].starts_at)) : month;
  const thisMonth = monthStart(new Date());

  const cells = useMemo(() => {
    const offset = (month.getDay() + 6) % 7; // Monday-first grid
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const confirm = async () => {
    if (!picked) return;
    setError("");
    setSaving(true);
    const { error } = await supabase.rpc("choose_slot", { p_consultation_id: consultationId, p_slot_id: picked.id });
    setSaving(false);
    if (error) {
      setPicked(null);
      setError(error.message.includes("SLOT_TAKEN") ? "Sorry, that time was just taken. Please pick another one." : error.message);
      return load();
    }
    setEditing(false);
    setPicked(null);
    onBooked();
  };

  if (slot && !editing) return <BookedCall slot={slot} course={course} onChange={() => setEditing(true)} />;

  const daySlots = day ? byDay.get(day) ?? [] : [];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="rounded-2xl border-2 border-brand-blue/20 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h3 className="flex items-center gap-2 font-black">
          <CalendarCheck className="h-5 w-5 text-brand-blue" /> {slot ? "Change your call time" : "Book your free 30-minute call"}
        </h3>
        <span className="text-xs text-slate-500">Your time zone: {tz}</span>
      </div>

      {!slots ? (
        <Spinner />
      ) : slots.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">No times are open right now. Your advisor will contact you to arrange a call.</p>
      ) : (
        <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1fr_14rem]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                disabled={month <= thisMonth}
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
                    aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${available ? `, ${byDay.get(k)!.length} times available` : ", no times"}`}
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
            {day && daySlots.length > 0 ? (
              <>
                <p className="mb-2 text-sm font-extrabold">
                  {new Date(daySlots[0].starts_at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {daySlots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={picked?.id === s.id}
                      onClick={() => setPicked(s)}
                      className={`rounded-xl border-2 py-2.5 text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                        picked?.id === s.id ? "border-brand-blue bg-brand-blue text-white" : "border-slate-100 bg-mist hover:border-brand-blue/40"
                      }`}
                    >
                      {timeOf(s.starts_at)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Pick a highlighted day to see the available times.</p>
            )}
          </div>
        </div>
      )}

      {(picked || error || slot) && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 sm:px-5">
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {picked ? (
              <p className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-brand-blue" />
                <strong>{formatSlot(picked.starts_at, { weekday: "long", month: "long" })}</strong>
              </p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {slot && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Keep current time
                </Button>
              )}
              {picked && (
                <Button onClick={confirm} loading={saving}>
                  Confirm booking
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookedCall({ slot, course, onChange }: { slot: BookedSlot; course: string; onChange: () => void }) {
  const start = new Date(slot.starts_at);
  const end = new Date(start.getTime() + slot.duration_minutes * 60000);
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
      `UID:${slot.id}@consultation.outreachstudy.eu`,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CalendarCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Your free call is booked</p>
            <p className="text-lg font-black">{formatSlot(slot.starts_at, { weekday: "long", month: "long" })}</p>
            <p className="text-sm text-slate-600">{slot.duration_minutes} minutes · your advisor will call you on WhatsApp</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onChange}>
          Change time
        </Button>
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
