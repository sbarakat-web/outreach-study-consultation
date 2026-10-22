// Sends the instant new-lead alert (admin) with a one-tap WhatsApp reply.
// Candidates get a single email from Supabase Auth (application received + sign-in
// code, see supabase/templates/confirm-signup.html), so none is sent from here.
// Called by the app right after book_consultation(). Each request is confirmed
// at most once and only within 15 minutes of creation, so the public endpoint
// can't be used to re-send mail for old requests.
//
// Secrets: RESEND_API_KEY (required for email); optional overrides MAIL_FROM, ADMIN_NOTIFY_EMAIL, APP_URL
// Optional WhatsApp (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = (k: string) => Deno.env.get(k) ?? "";

const DEFAULTS: Record<string, string> = {
  MAIL_FROM: "Outreach <hello@consultation.outreachstudy.eu>",
  ADMIN_NOTIFY_EMAIL: "sbarakat@outreachrecruitment.net",
  APP_URL: "https://consultation.outreachstudy.eu",
};
const setting = (k: string) => env(k) || DEFAULTS[k] || "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function formatSlot(startsAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Malta",
  }).format(new Date(startsAt)) + " (Malta time)";
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: setting("MAIL_FROM"), to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sendWhatsApp(to: string, text: string) {
  const sid = env("TWILIO_ACCOUNT_SID");
  if (!sid || !env("TWILIO_AUTH_TOKEN") || !env("TWILIO_WHATSAPP_FROM")) return;
  const digits = to.replace(/[^\d+]/g, "");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: `whatsapp:${env("TWILIO_WHATSAPP_FROM")}`,
      To: `whatsapp:${digits.startsWith("+") ? digits : "+" + digits}`,
      Body: text,
    }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { consultation_id } = await req.json().catch(() => ({}));
  if (typeof consultation_id !== "string") return json({ error: "consultation_id required" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  // Claim the confirmation first so concurrent calls can't double-send.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: c, error } = await db
    .from("consultations")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", consultation_id)
    .is("confirmation_sent_at", null)
    .gte("created_at", cutoff)
    .select("*, slots(starts_at, duration_minutes)")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!c) return json({ skipped: true });

  const slot = Array.isArray(c.slots) ? c.slots[0] : c.slots;
  const when = slot ? formatSlot(slot.starts_at) : null;
  const appUrl = setting("APP_URL");
  const first = c.full_name.split(" ")[0];
  const course = c.desired_course || "your studies";
  const level = c.english_level === "b2_plus" ? "B2 or above" : c.english_level === "below_b2" ? "Below B2" : c.english_level;
  const tracking = c.tracking ?? {};
  const source = [tracking.utm_source, tracking.utm_medium, tracking.utm_campaign].filter(Boolean).join(" / ") || tracking.referrer || "direct";

  const results: Record<string, string> = {};
  if (!env("RESEND_API_KEY")) return json({ ok: true, results: { email: "not-configured" } });

  try {
    const digits = (c.whatsapp ?? "").replace(/\D/g, "");
    const reply = `Hi ${first}, this is Outreach about your application for ${course}. When is a good time for a short call?`;
    const row = (k: string, v: string | null | undefined) =>
      v ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0"><strong>${escape(v)}</strong></td></tr>` : "";
    await sendEmail(
      setting("ADMIN_NOTIFY_EMAIL"),
      `New lead: ${c.full_name} — ${course}${c.start_date ? " (" + c.start_date + ")" : ""}`,
      `<div style="font-family:Arial,sans-serif;color:#172554;line-height:1.5;max-width:560px">
        <h2 style="margin-bottom:4px">New application</h2>
        <table style="border-collapse:collapse;font-size:14px">
          ${row("Name", c.full_name)}${row("Course", course)}${row("English", level)}${row("Start", c.start_date)}
          ${row("Country", c.country)}${row("WhatsApp", c.whatsapp)}${row("Email", c.email)}${row("Call", when)}
          ${row("Notes", c.message)}${row("Source", source)}
        </table>
        <p style="margin-top:20px">
          ${digits ? `<a href="https://wa.me/${digits}?text=${encodeURIComponent(reply)}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Reply on WhatsApp</a>&nbsp;` : ""}
          <a href="${appUrl}/admin?lead=${c.id}" style="display:inline-block;background:#442DFA;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Open admin</a>
        </p>
      </div>`,
    );
    results.admin = "sent";
  } catch (e) {
    results.admin = String(e);
  }

  if (c.whatsapp) {
    try {
      await sendWhatsApp(
        c.whatsapp,
        when
          ? `Hi ${c.full_name.split(" ")[0]}, your free call with Outreach is booked for ${when}.`
          : `Hi ${c.full_name.split(" ")[0]}, thanks for your request! An Outreach advisor will contact you shortly.`,
      );
      results.whatsapp = "sent-or-not-configured";
    } catch (e) {
      results.whatsapp = String(e);
    }
  }

  return json({ ok: true, results });
});
