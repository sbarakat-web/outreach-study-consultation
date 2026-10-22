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
      ...(["new", "contacted", "qualified"].includes(c.status) ? { status: "consultation_booked" as const } : {}),
    })
    .eq("id", c.id);
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
