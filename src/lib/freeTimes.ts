import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { CALL_MINUTES, callTimes } from "./options";

/**
 * Call times that are actually free: weekday call hours minus confirmed calls and the
 * adviser's Google Calendar busy times. Shared by the candidate calendar and the admin slot picker.
 */
export function useFreeTimes(minHoursAhead?: number) {
  const allTimes = useMemo(() => callTimes(new Date(), minHoursAhead), [minHoursAhead]);
  const [blocked, setBlocked] = useState<{ start: number; end: number }[] | null>(null);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    if (!allTimes.length) return setBlocked([]);
    const from = allTimes[0].toISOString();
    const to = allTimes[allTimes.length - 1].toISOString();
    Promise.all([
      supabase.rpc("booked_call_times"),
      supabase.functions.invoke("google-calendar", { body: { action: "public-busy", from, to } }).catch(() => ({ data: null, error: true })),
    ]).then(([booked, busy]) => {
      const span = CALL_MINUTES * 60_000;
      const googleBusy = (busy.data as { busy?: { start: string; end: string }[]; error?: string } | null) ?? null;
      setGoogle(!!googleBusy && !googleBusy.error && !busy.error);
      setBlocked([
        ...((booked.data ?? []) as { starts_at: string }[]).map((b) => ({ start: new Date(b.starts_at).getTime(), end: new Date(b.starts_at).getTime() + span })),
        ...(googleBusy?.busy ?? []).map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() })),
      ]);
    });
  }, [allTimes]);

  const isFree = useMemo(() => {
    const span = CALL_MINUTES * 60_000;
    return (ms: number) => !(blocked ?? []).some((b) => ms < b.end && ms + span > b.start);
  }, [blocked]);

  const times = useMemo(() => allTimes.filter((t) => isFree(t.getTime())), [allTimes, isFree]);
  return { times, isFree, loading: blocked === null, google };
}
