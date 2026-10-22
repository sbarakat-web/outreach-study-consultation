// Candidate emails sent by staff actions:
//   { type: "call-confirmed", consultationId }  time in the candidate's time zone, Meet link, .ics, prepare documents
//   { type: "rebook", consultationId }          missed session → pick a new time
// Returns waUrl (WhatsApp Web link with the same short message). Staff only.
// Secrets: RESEND_API_KEY; optional MAIL_FROM, APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const MAIL_FROM = () => env("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>";
const CALL_MINUTES = 20;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const layout = (inner: string) => `<div style="font-family:Arial,sans-serif;color:#14123a;line-height:1.6;max-width:560px">
  <div style="height:6px;background:#442DFA;border-radius:6px 6px 0 0"></div>
  <img src="${APP_URL()}/logo.png" alt="Outreach — Study in Malta" width="180" style="display:block;margin:20px 0">
  ${inner}
  <p style="color:#94a3b8;font-size:12px;margin-top:24px">Outreach — Study in Malta · <a href="https://outreachstudy.eu" style="color:#442DFA">outreachstudy.eu</a></p>
</div>`;
const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#442DFA;color:#fff;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:bold;margin:4px 6px 4px 0">${label}</a>`;

function whenIn(iso: string, tz: string) {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: zone }).format(new Date(iso));
  try {
    return tz && tz !== "Europe/Malta" ? `${fmt(tz)} (your time) · ${fmt("Europe/Malta")} Malta time` : `${fmt("Europe/Malta")} (Malta time)`;
  } catch {
    return `${fmt("Europe/Malta")} (Malta time)`;
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
    html = layout(`
      <h2 style="margin:0 0 8px">Hi ${escape(first)}, your call is confirmed!</h2>
      <p style="font-size:16px"><strong>${escape(when)}</strong><br>${CALL_MINUTES} minutes${c.meeting_url ? " · online (Google Meet)" : " · your advisor will call you on WhatsApp"}</p>
      <p>${c.meeting_url ? button(c.meeting_url, "Join the call") : ""}${button(`${APP_URL()}/dashboard`, "Open my dashboard")}</p>
      <div style="background:#f0eeff;border-radius:14px;padding:14px 18px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Prepare for your call</strong></p>
        <p style="margin:0">Please upload your <strong>passport</strong> and your <strong>latest certificate</strong> before the call, so your advisor can review your profile.</p>
        <p style="margin:10px 0 0"><a href="${APP_URL()}/dashboard/documents" style="color:#442DFA;font-weight:bold">Upload documents →</a></p>
      </div>
      <p style="color:#64748b;font-size:13px">The calendar invite is attached. Need another time? Reply to this email or message us on WhatsApp.</p>`);
    wa = `Hi ${first}, your free call with Outreach is confirmed for ${when}.${c.meeting_url ? ` Join here: ${c.meeting_url}` : ""} Please upload your passport and latest certificate before the call: ${APP_URL()}/dashboard/documents`;
  } else if (type === "rebook") {
    subject = `${first}, let's find a new time for your call`;
    html = layout(`
      <h2 style="margin:0 0 8px">Hi ${escape(first)}, we missed you!</h2>
      <p>We couldn't reach you at your scheduled call. No problem — pick a new time that suits you and we'll confirm it.</p>
      <p>${button(`${APP_URL()}/dashboard`, "Pick a new time")}</p>`);
    wa = `Hi ${first}, we missed you at your Outreach call today. Please pick a new time here: ${APP_URL()}/dashboard`;
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
