// Sends the instant new-lead alert (admin) with a one-tap WhatsApp reply.
// Candidates get a single email from Supabase Auth (application received + sign-in
// code, see supabase/templates/confirm-signup.html), so none is sent from here.
// Called by the app right after book_consultation(). Each request is confirmed
// at most once and only within 15 minutes of creation, so the public endpoint
// can't be used to re-send mail for old requests.
//
// Secrets: RESEND_API_KEY (required for email); optional overrides MAIL_FROM, ADMIN_NOTIFY_EMAIL, APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, layout, title, escape } from "../_shared/email.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { consultation_id } = await req.json().catch(() => ({}));
  if (typeof consultation_id !== "string") return json({ error: "consultation_id required" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  // Claim the alert first so concurrent calls can't double-send.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: c, error } = await db
    .from("consultations")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", consultation_id)
    .is("confirmation_sent_at", null)
    .gte("created_at", cutoff)
    .select("*")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!c) return json({ skipped: true });
  if (!env("RESEND_API_KEY")) return json({ ok: true, results: { email: "not-configured" } });

  const appUrl = setting("APP_URL");
  const first = c.full_name.split(" ")[0];
  const course = c.desired_course || "your studies";
  const level = c.english_level === "b2_plus" ? "B2 or above" : c.english_level === "below_b2" ? "Below B2" : c.english_level;
  const tracking = c.tracking ?? {};
  const source = [tracking.utm_source, tracking.utm_medium, tracking.utm_campaign].filter(Boolean).join(" / ") || tracking.referrer || "direct";
  const digits = (c.whatsapp ?? "").replace(/\D/g, "");
  const reply = `Hi ${first}, this is Outreach about your application for ${course}. When is a good time for a short call?`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: setting("MAIL_FROM"),
      to: setting("ADMIN_NOTIFY_EMAIL"),
      subject: `New lead: ${c.full_name} — ${course}${c.start_date ? " (" + c.start_date + ")" : ""}`,
      html: layout(
        eyebrow("New application") +
          title(escape(c.full_name)) +
          facts([
            ["Course", course],
            ["English", level],
            ["Start", c.start_date],
            ["Country", c.country],
            ["WhatsApp", c.whatsapp],
            ["Email", c.email],
            ["Notes", c.message],
            ["Source", source],
          ]) +
          actions(
            digits ? button(`https://wa.me/${digits}?text=${encodeURIComponent(reply)}`, "Reply on WhatsApp", "#25D366") : "",
            button(`${appUrl}/admin?lead=${c.id}`, "Open lead"),
          ),
        `${c.full_name} applied for ${course}`,
      ),
    }),
  });
  return json({ ok: res.ok, results: { admin: res.ok ? "sent" : await res.text() } });
});
