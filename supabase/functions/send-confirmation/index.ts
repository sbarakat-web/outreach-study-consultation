// Sends the booking confirmation (candidate) and a new-request alert (admin).
// Called by the app right after book_consultation(). Each request is confirmed
// at most once and only within 15 minutes of creation, so the public endpoint
// can't be used to re-send mail for old requests.
//
// Secrets: RESEND_API_KEY, MAIL_FROM, ADMIN_NOTIFY_EMAIL, APP_URL
// Optional WhatsApp (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = (k: string) => Deno.env.get(k) ?? "";

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
    body: JSON.stringify({ from: env("MAIL_FROM"), to, subject, html }),
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
  const appUrl = env("APP_URL") || "https://consultation.outreachrecruitment.eu";
  const name = escape(c.full_name.split(" ")[0]);

  const results: Record<string, string> = {};

  try {
    await sendEmail(
      c.email,
      when ? "Your free consultation is booked" : "We received your consultation request",
      `<div style="font-family:Arial,sans-serif;color:#172554;line-height:1.5">
        <h2>Hi ${name},</h2>
        <p>Thank you for your request with Outreach Recruitment.</p>
        ${when
          ? `<p><strong>Your consultation:</strong> ${escape(when)}</p><p>We'll contact you on WhatsApp or by email at that time.</p>`
          : `<p>An advisor will contact you shortly to agree on a time.</p>`}
        <p>You can follow your request and upload documents here:<br>
        <a href="${appUrl}/dashboard">${appUrl}/dashboard</a></p>
        <p>— The Outreach Recruitment team</p>
      </div>`,
    );
    results.email = "sent";
  } catch (e) {
    results.email = String(e);
  }

  if (env("ADMIN_NOTIFY_EMAIL")) {
    try {
      await sendEmail(
        env("ADMIN_NOTIFY_EMAIL"),
        `New consultation: ${c.full_name}${when ? " — " + when : ""}`,
        `<div style="font-family:Arial,sans-serif">
          <p><strong>${escape(c.full_name)}</strong> (${escape(c.email)}, ${escape(c.whatsapp ?? "no WhatsApp")})</p>
          <p>${escape([c.study_path, c.english_level, c.country].filter(Boolean).join(" · "))}</p>
          <p>${when ? "Slot: " + escape(when) : "No slot chosen"}</p>
          <p><a href="${appUrl}/admin">Open admin</a></p>
        </div>`,
      );
      results.admin = "sent";
    } catch (e) {
      results.admin = String(e);
    }
  }

  if (c.whatsapp) {
    try {
      await sendWhatsApp(
        c.whatsapp,
        when
          ? `Hi ${c.full_name.split(" ")[0]}, your free consultation with Outreach Recruitment is booked for ${when}.`
          : `Hi ${c.full_name.split(" ")[0]}, thanks for your request! An Outreach Recruitment advisor will contact you shortly.`,
      );
      results.whatsapp = "sent-or-not-configured";
    } catch (e) {
      results.whatsapp = String(e);
    }
  }

  return json({ ok: true, results });
});
