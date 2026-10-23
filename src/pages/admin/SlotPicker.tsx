import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { SlotGrid } from "../../components/SlotGrid";
import { useFreeTimes } from "../../lib/freeTimes";
import { toLocalInput } from "./calls";

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

  // Auto-select once the free slots are known.
  useEffect(() => {
    if (loading || value) return;
    const best = bestSlot(times, preferred);
    if (best) onChange(best.toISOString());
  }, [loading, times, preferred, value, onChange]);

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
      ) : times.length === 0 ? (
        <p className="text-xs text-slate-500">No free times in the next 3 weeks.</p>
      ) : (
        <SlotGrid times={times} value={value} onChange={onChange} timeZone="Europe/Malta" starred={preferred} />
      )}
      <button type="button" onClick={() => setCustom((v) => !v)} className="text-xs font-bold text-brand hover:underline">
        {custom ? "Back to free times" : "Other time…"}
      </button>
    </div>
  );
}
