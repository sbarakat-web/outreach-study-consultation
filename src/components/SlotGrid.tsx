import { useMemo, useState } from "react";
import { Star } from "lucide-react";

/**
 * Free call slots as day chips + a time grid. Shown in `timeZone` (default: the viewer's own),
 * with the times in `locale`. `starred` marks one time (e.g. the candidate's own choice).
 */
export function SlotGrid({
  times,
  value,
  onChange,
  timeZone,
  locale = "en-GB",
  starred,
}: {
  times: Date[];
  value: string;
  onChange: (iso: string) => void;
  timeZone?: string;
  locale?: string;
  starred?: string | null;
}) {
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const dayLabel = (d: Date) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone }).format(d);
  const timeLabel = (d: Date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(d);

  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const t of times) map.set(dayKey(t), [...(map.get(dayKey(t)) ?? []), t]);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, timeZone]);

  const selected = value ? new Date(value) : null;
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? (selected && byDay.has(dayKey(selected)) ? dayKey(selected) : ([...byDay.keys()][0] ?? null));

  return (
    <div className="space-y-2.5">
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
          const star = starred && new Date(starred).getTime() === t.getTime();
          return (
            <button
              key={t.toISOString()}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(t.toISOString())}
              className={`relative rounded-md py-2 text-xs font-bold transition ${on ? "bg-brand text-white" : "bg-white text-navy ring-1 ring-slate-200 hover:ring-brand/40"}`}
            >
              {timeLabel(t)}
              {star && <Star className={`absolute -right-1 -top-1 h-3.5 w-3.5 ${on ? "fill-amber-300 text-amber-300" : "fill-amber-400 text-amber-400"}`} aria-label="Candidate's choice" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
