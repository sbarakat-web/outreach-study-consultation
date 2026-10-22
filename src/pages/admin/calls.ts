// Shared call actions for the lead panel and the admin Calendar.
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_MINUTES, formatSlot } from "../../lib/options";
import type { Consultation } from "../../lib/types";

export const maltaTime = (iso: string) => formatSlot(iso, { weekday: "long", month: "long", timeZone: "Europe/Malta" });

// datetime-local value in the admin's own time zone
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Confirm the call at `iso`: the candidate's dashboard turns green and they join the online-session queue. */
export async function confirmCall(c: Consultation, iso: string) {
  return supabase
    .from("consultations")
    .update({
      call_status: "confirmed",
      preferred_call_at: iso,
      call_reviewed_at: c.call_reviewed_at ?? new Date().toISOString(),
      call_declined_at: null,
      reminder_24h_at: null,
      reminder_1h_at: null,
      ...(["new", "contacted", "qualified"].includes(c.status) ? { status: "consultation_booked" as const } : {}),
    })
    .eq("id", c.id);
}

export const googleApi = (action: string, body: Record<string, unknown> = {}) =>
  supabase.functions.invoke("google-calendar", { body: { action, ...body } });

export const notifyCandidate = (type: "call-confirmed" | "rebook" | "booking-link", consultationId: string) =>
  supabase.functions.invoke("notify", { body: { type, consultationId } });

/** Send the WhatsApp link to a tab opened synchronously in the click handler (or close it). */
export const fillTab = (tab: Window | null, url?: string | null) => {
  if (!tab) return;
  if (url) tab.location.href = url;
  else tab.close();
};

export interface ConfirmResult {
  error?: string;
  meetUrl?: string | null;
  emailed: boolean;
  googleError?: string;
}

/**
 * One click: confirm the time, create (or move) the Google event with a Meet link when
 * Google is connected, email the candidate and hand the WhatsApp message to `waTab`.
 */
export async function confirmAndNotify(c: Consultation, iso: string, opts: { google: boolean; waTab: Window | null }): Promise<ConfirmResult> {
  const moving = c.call_status === "confirmed" && !!c.google_event_id;
  const { error } = moving
    ? await supabase.from("consultations").update({ preferred_call_at: iso, reminder_24h_at: null, reminder_1h_at: null }).eq("id", c.id)
    : await confirmCall(c, iso);
  if (error) {
    fillTab(opts.waTab);
    return { error: error.message, emailed: false };
  }
  let meetUrl: string | null | undefined;
  let googleError: string | undefined;
  if (opts.google) {
    const r = await googleApi(moving ? "move-event" : "create-event", { consultationId: c.id, at: iso });
    if (r.error || r.data?.error) googleError = r.data?.error ?? r.error?.message;
    meetUrl = r.data?.meetUrl;
  }
  const n = await notifyCandidate("call-confirmed", c.id);
  fillTab(opts.waTab, n.data?.waUrl);
  return { meetUrl, emailed: !!n.data?.ok, googleError };
}

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
