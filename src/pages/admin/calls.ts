// Shared call actions for the lead panel and the admin Calendar.
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_MINUTES, formatSlot } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { COUNTRIES, timeZonesOf } from "../../lib/countries";

export const maltaTime = (iso: string) => formatSlot(iso, { weekday: "long", month: "long", timeZone: "Europe/Malta" });

/** The candidate's time zone: from their browser when they applied, else their country, else Malta. */
export function candidateTz(c: Pick<Consultation, "tracking" | "country">) {
  if (c.tracking?.tz) return c.tracking.tz;
  const code = COUNTRIES.find((x) => x.name === c.country || x.code === c.country)?.code;
  return (code && timeZonesOf(code)[0]) || "Europe/Malta";
}

const place = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");
const sameClock = (iso: string, tz: string) =>
  formatSlot(iso, { timeZone: tz, weekday: undefined }) === formatSlot(iso, { timeZone: "Europe/Malta", weekday: undefined });

/** "Tuesday 4 November, 10:00 (Casablanca)" — the candidate's own time; null when it equals Malta time. */
export function candidateTime(c: Pick<Consultation, "tracking" | "country">, iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long" }) {
  const tz = candidateTz(c);
  if (tz === "Europe/Malta" || sameClock(iso, tz)) return null;
  try {
    return `${formatSlot(iso, { ...opts, timeZone: tz })} (${place(tz)})`;
  } catch {
    return null;
  }
}

// datetime-local value in the admin's own time zone
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const googleApi = (action: string, body: Record<string, unknown> = {}) =>
  supabase.functions.invoke("google-calendar", { body: { action, ...body } });

export const notifyCandidate = (
  type: "call-confirmed" | "rebook" | "booking-link" | "suggest-time" | "hold" | "confirm" | "pick-another" | "reinvite",
  consultationId: string,
  at?: string,
  extra: Record<string, unknown> = {},
) => supabase.functions.invoke("notify", { body: { type, consultationId, at, ...extra } });

/** Send the WhatsApp link to a tab opened synchronously in the click handler (or close it). */
export const fillTab = (tab: Window | null, url?: string | null) => {
  if (!tab) return;
  if (url) tab.location.href = url;
  else tab.close();
};

/**
 * Send the candidate a suggested time (email + WhatsApp) with a one-click confirm link.
 * The call stays unconfirmed until they click it (or you mark it confirmed).
 */
export async function suggestTime(c: Consultation, iso: string, waTab: Window | null) {
  const r = await notifyCandidate("suggest-time", c.id, iso);
  const error = r.data?.error ?? (r.error ? r.error.message : undefined);
  fillTab(waTab, error ? null : r.data?.waUrl);
  return { error, emailed: !!r.data?.ok };
}

/** Time agreed with the candidate (or they replied YES): hold it as "awaiting confirmation" — no email yet. */
export async function holdTime(c: Consultation, iso: string) {
  const r = await notifyCandidate("hold", c.id, iso);
  return { error: r.data?.error ?? (r.error ? r.error.message : undefined) };
}

/**
 * Confirm the held time with the Meet link created in Google Calendar: "We're waiting for you" email (CC main admin);
 * the WhatsApp version opens in `waTab`.
 */
export async function confirmWithMeet(c: Consultation, meetUrl: string, waTab: Window | null) {
  const r = await notifyCandidate("confirm", c.id, undefined, { meetUrl });
  const error = r.data?.error ?? (r.error ? ((await (r.error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? r.error.message) : undefined);
  fillTab(waTab, error ? null : r.data?.waUrl);
  return { error, emailed: !!r.data?.ok };
}

/**
 * Their time isn't available: release it and send them (email + WhatsApp in `waTab`) a link to choose another free
 * time themselves. Their new pick comes back as "Awaiting confirmation".
 */
export async function askToPickAnother(c: Consultation, waTab: Window | null) {
  const r = await notifyCandidate("pick-another", c.id);
  const error = r.data?.error ?? (r.error ? ((await (r.error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? r.error.message) : undefined);
  fillTab(waTab, error ? null : r.data?.waUrl);
  return { error, emailed: !!r.data?.ok };
}

const maltaLong = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(iso));

/** WhatsApp text for a confirmed call. Keep in sync with waitingWhatsApp in supabase/functions/_shared/booked.ts. */
export const waitingWhatsApp = (c: Consultation) =>
  [
    `Hi ${c.full_name.split(" ")[0]} 👋 this is Soufiane from Outreach — Study in Malta.`,
    "",
    "Thank you for booking your free consultation! 🎉 We're waiting for you on:",
    ...(candidateTime(c, c.preferred_call_at!)
      ? [`📅 *${candidateTime(c, c.preferred_call_at!)}*`, `🇲🇹 ${maltaLong(c.preferred_call_at!)} (Malta time)`]
      : [`📅 *${maltaLong(c.preferred_call_at!)} (Malta time)*`]),
    c.meeting_url ? `🎥 Google Meet: ${c.meeting_url}` : "🎥 We'll send you the Google Meet link before the call.",
    "📩 You'll also get a Google Calendar invitation by email — please accept it.",
    ...(c.attendance_deadline && !c.attendance_confirmed_at
      ? [
          "",
          `⚠️ *IMPORTANT:* please reply *YES* to confirm you'll attend${c.call_confirm_token ? ` (or tap: ${window.location.origin}/confirm-call?t=${c.call_confirm_token}&attend=1)` : ""}.`,
          `If we don't hear from you by *${candidateTime(c, c.attendance_deadline, { weekday: "long", month: "long" }) ?? `${maltaLong(c.attendance_deadline)} (Malta time)`}*, the booking will be cancelled automatically.`,
        ]
      : []),
    "",
    `In ${CALL_MINUTES} minutes we'll look at the best study options in Malta for you, the costs, scholarships and the visa steps — and answer all your questions.`,
    "",
    `📎 If you can, upload your passport and latest certificate before the call: ${window.location.origin}/dashboard`,
    "",
    "If you need to change the time, just reply here. See you soon! 😊",
  ].join("\n");

/** Admins + session presenters, for adviser pickers. */
export async function loadStaff() {
  const { data } = await supabase.rpc("staff_list");
  return ((data ?? []) as { email: string; role: string }[]).sort((a, b) => a.email.localeCompare(b.email));
}

export const bookingMessage = (c: Consultation) =>
  `Hi ${c.full_name.split(" ")[0]}, this is Outreach. Thank you for your application for ${c.desired_course || "your studies"} — we've reviewed your profile and would love to talk. Please confirm your free call here: ${BOOKING_LINK}`;

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Pre-filled event for the adviser's own Google Calendar (blocks the slot, links back to the lead). */
export function googleEventUrl(c: Consultation, iso: string) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + CALL_MINUTES * 60000);
  const details = [
    `Candidate: ${c.full_name} (${c.email})`,
    c.whatsapp ? `WhatsApp: ${c.whatsapp}` : "",
    `Course: ${c.desired_course || "-"}`,
    `Lead: ${window.location.origin}/admin?lead=${c.id}`,
    `Online session: ${window.location.origin}/onlinesessions?present=1&candidate=${c.id}`,
    c.meeting_url ? `Meet: ${c.meeting_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Outreach call — ${c.full_name}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details,
    add: c.email,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** The adviser's Google Calendar week view for a given day. */
export const googleWeekUrl = (d: Date) =>
  `https://calendar.google.com/calendar/r/week/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
