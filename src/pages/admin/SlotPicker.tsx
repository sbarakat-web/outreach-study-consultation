import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Star } from "lucide-react";
import { useFreeTimes } from "../../lib/freeTimes";
import { toLocalInput } from "./calls";

const maltaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Malta" }).format(d);
const dayLabel = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Malta" }).format(d);
const timeLabel = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(d);

/** Pick the candidate's time when it's free, otherwise the nearest free slot after it (or the first free one). */
function bestSlot(times: Date[], preferred?: string | null) {
  if (!times.length) return null;
  if (!preferred) return times[0];
  const p = new Date(preferred).getTime();
  return times.find((t) => t.getTime() === p) ?? times.find((t) => t.getTime() > p) ?? times[0];
}

/**
 * Free call slots straight from your Google Calendar (busy times and confirmed calls removed), Malta time.
 * Pre-selects the candidate's requested time when it's free, otherwise the nearest free one.
 */
export function SlotPicker({ value, onChange, preferred }: { value: string; onChange: (iso: string) => void; preferred?: string | null }) {
  const { times, isFree, loading, google } = useFreeTimes(2);
  const [custom, setCustom] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const t of times) map.set(maltaDay(t), [...(map.get(maltaDay(t)) ?? []), t]);
    return map;
  }, [times]);

  // Auto-select once the free slots are known.
  useEffect(() => {
    if (loading || value) return;
    const best = bestSlot(times, preferred);
    if (best) onChange(best.toISOString());
  }, [loading, times, preferred, value, onChange]);

  const selected = value ? new Date(value) : null;
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? (selected ? maltaDay(selected) : [...byDay.keys()][0] ?? null);
  const preferredBusy = !!preferred && !loading && new Date(preferred) > new Date() && !isFree(new Date(preferred).getTime());

  if (loading) return <p className="text-xs text-slate-500">Loading free times from Google Calendar…</p>;

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarCheck className="h-3.5 w-3.5 text-brand" />
        {google ? "Free times from your Google Calendar" : "Free call times"} · Malta time
      </p>
      {preferredBusy && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Their time is busy in your calendar — the nearest free time is selected.
        </p>
      )}

      {custom ? (
        <input
          type="datetime-local"
          className="field w-auto py-2"
          value={toLocalInput(value || null)}
          onChange={(e) => e.target.value && onChange(new Date(e.target.value).toISOString())}
          aria-label="Custom call time"
        />
      ) : byDay.size === 0 ? (
        <p className="text-xs text-slate-500">No free times in the next 3 weeks.</p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[...byDay.entries()].map(([k, list]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDay(k)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  k === activeDay ? "bg-brand text-white" : "bg-white text-navy ring-1 ring-slate-200 hover:ring-brand/40"
                }`}
              >
                {dayLabel(list[0])}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {(byDay.get(activeDay ?? "") ?? []).map((t) => {
              const on = selected?.getTime() === t.getTime();
              const asked = preferred && new Date(preferred).getTime() === t.getTime();
              return (
                <button
                  key={t.toISOString()}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(t.toISOString())}
                  className={`relative rounded-md py-2 text-xs font-bold transition ${
                    on ? "bg-brand text-white" : "bg-white text-navy ring-1 ring-slate-200 hover:ring-brand/40"
                  }`}
                >
                  {timeLabel(t)}
                  {asked && <Star className={`absolute -right-1 -top-1 h-3.5 w-3.5 ${on ? "fill-amber-300 text-amber-300" : "fill-amber-400 text-amber-400"}`} aria-label="Candidate's choice" />}
                </button>
              );
            })}
          </div>
        </>
      )}
      <button type="button" onClick={() => setCustom((v) => !v)} className="text-xs font-bold text-brand hover:underline">
        {custom ? "Back to free times" : "Other time…"}
      </button>
    </div>
  );
}
