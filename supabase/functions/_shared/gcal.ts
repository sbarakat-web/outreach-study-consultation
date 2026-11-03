// "Add to Google Calendar" link for staff emails: opens Google Calendar with the call filled in
// (title, time, candidate as guest, lead link). The adviser adds Meet if needed and clicks Save.
// Keep in sync with googleEventUrl in src/pages/admin/calls.ts.
import { APP_URL, CALL_MINUTES } from "./call.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function gcalLink(c: Row, at: string) {
  const start = new Date(at);
  const end = new Date(start.getTime() + CALL_MINUTES * 60_000);
  const details = [
    `Candidate: ${c.full_name} (${c.email})`,
    c.whatsapp ? `WhatsApp: ${c.whatsapp}` : "",
    `Course: ${c.desired_course || "-"}`,
    `Lead: ${APP_URL()}/admin?lead=${c.id}`,
    `Online session: ${APP_URL()}/onlinesessions?present=1&candidate=${c.id}`,
    c.meeting_url ? `Meet: ${c.meeting_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({ action: "TEMPLATE", text: `Outreach call — ${c.full_name}`, dates: `${stamp(start)}/${stamp(end)}`, details, add: c.email });
  return `https://calendar.google.com/calendar/render?${params}`;
}
