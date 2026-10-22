// Call emails shared by notify (staff actions) and confirm-call (candidate one-click confirm).
import { actions, button, eyebrow, highlight, layout, para, title, escape } from "./email.ts";

export const CALL_MINUTES = 20;
export const APP_URL = () => Deno.env.get("APP_URL") || "https://consultation.outreachstudy.eu";
export const MAIL_FROM = () => Deno.env.get("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>";
export const BOOKING_LINK = () => Deno.env.get("BOOKING_LINK") || "https://calendar.app.google/FpLsWb5W5Q73v6JE7";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** The time in the candidate's zone, with Malta time underneath when they differ. */
export function whenIn(iso: string, tz: string) {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: zone }).format(new Date(iso));
  try {
    return tz && tz !== "Europe/Malta"
      ? { main: `${fmt(tz)} (your time)`, sub: `${fmt("Europe/Malta")} Malta time` }
      : { main: fmt("Europe/Malta"), sub: "Malta time" };
  } catch {
    return { main: fmt("Europe/Malta"), sub: "Malta time" };
  }
}

export const tzOf = (c: Row) => c.tracking?.tz ?? "Europe/Malta";
export const firstName = (c: Row) => String(c.full_name).split(" ")[0];

/** "Your free call is confirmed" with the .ics invite, Meet link and documents reminder. */
export function confirmedEmail(c: Row) {
  const tz = tzOf(c);
  const first = firstName(c);
  const when = whenIn(c.preferred_call_at, tz);
  const start = new Date(c.preferred_call_at);
  const end = new Date(start.getTime() + CALL_MINUTES * 60_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Outreach//Consultation//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.id}@consultation.outreachstudy.eu`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Free call with Outreach",
    `DESCRIPTION:Your free Malta study consultation.${c.meeting_url ? `\\nJoin: ${c.meeting_url}` : ""}`,
    c.meeting_url ? `LOCATION:${c.meeting_url}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Free call with Outreach",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const subject = `Your free call is confirmed — ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(start)}`;
  const html = layout(
    eyebrow("Call confirmed") +
      title(`Hi ${escape(first)}, see you soon!`) +
      highlight(
        `<strong style="font-size:18px">${escape(when.main)}</strong><br><span style="color:#8a8ea8;font-size:13px">${escape(when.sub)} · ${CALL_MINUTES} minutes${
          c.meeting_url ? " · Google Meet" : " · WhatsApp call"
        }</span>`,
      ) +
      actions(c.meeting_url ? button(c.meeting_url, "Join the call") : "", button(`${APP_URL()}/dashboard`, "Open my dashboard", c.meeting_url ? "#14123a" : undefined)) +
      `<div style="margin:0 0 14px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
        <p style="margin:0 0 6px;color:#14123a"><strong>Prepare for your call</strong></p>
        <p style="margin:0;color:#5b6080">Please upload your <strong>passport</strong> and your <strong>latest certificate</strong> before the call, so your advisor can review your profile.</p>
        <p style="margin:10px 0 0"><a href="${APP_URL()}/dashboard/documents" style="color:#442DFA;font-weight:bold;text-decoration:none">Upload documents →</a></p>
      </div>` +
      para("The calendar invite is attached. Need another time? Reply to this email or message us on WhatsApp.", true),
    `Your call: ${when.main}`,
  );
  const wa = `Hi ${first}, your free call with Outreach is confirmed for ${when.main}.${c.meeting_url ? ` Join here: ${c.meeting_url}` : ""} Please upload your passport and latest certificate before the call: ${APP_URL()}/dashboard/documents`;
  return { subject, html, wa, attachments: [{ filename: "outreach-call.ics", content: b64(ics) }] };
}

export async function sendEmail(msg: { to: string; subject: string; html: string; attachments?: { filename: string; content: string }[] }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return "not-configured";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM(), ...msg }),
  });
  return res.ok ? "sent" : await res.text();
}
