// Server-side check of a call time picked by a candidate: must be a real call slot
// (Mon–Fri, on the hour 09:00–16:00 Malta like the Google appointment schedule, ≥ 12h ahead, within the next week) and still free
// (no other confirmed call or request awaiting confirmation, nothing busy in the Google Calendar).
import { CALL_MINUTES, freeBusy, googleConfigured } from "./google.ts";

const H = 3_600_000;

export function isCallSlot(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const ms = d.getTime();
  if (ms < Date.now() + 12 * H || ms > Date.now() + 8 * 24 * H) return false;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Malta", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(p.weekday) && d.getUTCSeconds() === 0 && minutes % 60 === 0 && minutes >= 9 * 60 && minutes + CALL_MINUTES <= 17 * 60;
}

// deno-lint-ignore no-explicit-any
export async function isSlotFree(db: any, iso: string, excludeId: string, ignoreEventOf?: { preferred_call_at?: string | null }) {
  const start = new Date(iso).getTime();
  const end = start + CALL_MINUTES * 60_000;
  const { data: clash } = await db
    .from("consultations")
    .select("id")
    .in("call_status", ["confirmed", "requested"])
    .is("call_declined_at", null)
    .neq("id", excludeId)
    .gt("preferred_call_at", new Date(start - CALL_MINUTES * 60_000).toISOString())
    .lt("preferred_call_at", new Date(end).toISOString())
    .limit(1);
  if (clash?.length) return false;
  if (!googleConfigured()) return true;
  const fb = await freeBusy(db, null, new Date(start).toISOString(), new Date(end).toISOString()).catch(() => null);
  if (!fb) return true; // Google unreachable: don't block the candidate
  // The candidate's own current event (when moving a confirmed call) doesn't count as busy.
  const own = ignoreEventOf?.preferred_call_at ? new Date(ignoreEventOf.preferred_call_at).getTime() : null;
  return !fb.busy.some((b) => !(own !== null && new Date(b.start).getTime() === own) && new Date(b.start).getTime() < end && new Date(b.end).getTime() > start);
}
