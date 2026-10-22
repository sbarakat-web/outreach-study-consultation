// Candidate emails sent by staff actions:
//   { type: "call-confirmed", consultationId }  time in the candidate's time zone, Meet link, .ics, prepare documents
//   { type: "rebook", consultationId }          missed session → pick a new time
//   { type: "booking-link", consultationId }    send the real Google booking page for the call
// Returns waUrl (WhatsApp Web link with the same short message). Staff only.
// Secrets: RESEND_API_KEY; optional MAIL_FROM, APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, highlight, layout, para, title, escape } from "../_shared/email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const MAIL_FROM = () => env("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>";
const CALL_MINUTES = 20;
const BOOKING_LINK = () => env("BOOKING_LINK") || "https://calendar.app.google/FpLsWb5W5Q73v6JE7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function whenIn(iso: string, tz: string) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const email = auth?.user?.email_confirmed_at ? auth.user.email?.toLowerCase() : null;
  if (!email) return json({ error: "Not signed in" }, 401);
  const [{ data: a }, { data: p }] = await Promise.all([
    db.from("admins").select("email").eq("email", email).maybeSingle(),
    db.from("session_presenters").select("email").eq("email", email).maybeSingle(),
  ]);
  if (!a && !p) return json({ error: "Staff only" }, 403);

  const { type, consultationId } = await req.json().catch(() => ({}));
  const { data: c } = await db.from("consultations").select("*").eq("id", consultationId).maybeSingle();
  if (!c) return json({ error: "Candidate not found" }, 404);
  const first = c.full_name.split(" ")[0];
  const tz = c.tracking?.tz ?? "Europe/Malta";
  const digits = (c.whatsapp ?? "").replace(/\D/g, "");

  let subject = "";
  let html = "";
  let wa = "";
  let attachments: { filename: string; content: string }[] | undefined;

  if (type === "call-confirmed") {
    if (!c.preferred_call_at) return json({ error: "No confirmed time" }, 400);
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
    attachments = [{ filename: "outreach-call.ics", content: b64(ics) }];
    subject = `Your free call is confirmed — ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(start)}`;
    html = layout(
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
    wa = `Hi ${first}, your free call with Outreach is confirmed for ${when.main}.${c.meeting_url ? ` Join here: ${c.meeting_url}` : ""} Please upload your passport and latest certificate before the call: ${APP_URL()}/dashboard/documents`;
  } else if (type === "rebook") {
    subject = `${first}, let's find a new time for your call`;
    html = layout(
      eyebrow("New time") +
        title(`Hi ${escape(first)}, we missed you!`) +
        para("We couldn't reach you at your scheduled call. No problem — pick a new time that suits you and we'll confirm it.", true) +
        actions(button(`${APP_URL()}/dashboard`, "Pick a new time")),
      "Pick a new time for your free call",
    );
    wa = `Hi ${first}, we missed you at your Outreach call today. Please pick a new time here: ${APP_URL()}/dashboard`;
  } else if (type === "booking-link") {
    const asked = c.requested_call_times?.[0] ? whenIn(c.requested_call_times[0], tz).main : null;
    subject = `${first}, book your free call with Outreach`;
    html = layout(
      eyebrow("Book your call") +
        title(`Hi ${escape(first)}, let's book your free call`) +
        para("We've reviewed your request. Please choose your call time on our booking page — it takes 30 seconds and adds the call to your calendar.", true) +
        (asked ? highlight(`<span style="color:#8a8ea8;font-size:13px">You asked for</span><br><strong style="font-size:17px">${escape(asked)}</strong>`) : "") +
        actions(button(BOOKING_LINK(), "Book my free call")) +
        para("Questions? Reply to this email or message us on WhatsApp.", true),
      "Choose your free call time",
    );
    wa = `Hi ${first}, this is Outreach. Thank you for your application for ${c.desired_course || "your studies"}! Please book your free call here: ${BOOKING_LINK()}`;
  } else {
    return json({ error: "Unknown type" }, 400);
  }

  let sent = "not-configured";
  if (env("RESEND_API_KEY")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM(), to: c.email, subject, html, attachments }),
    });
    sent = res.ok ? "sent" : await res.text();
  }
  return json({ ok: sent === "sent", email: sent, waUrl: digits ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(wa)}` : null });
});
