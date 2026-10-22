// Instant admin alert when a candidate requests a call time, with one-tap
// "Send booking link" (WhatsApp) and "Open in admin" buttons.
// Called by the dashboard right after request_call_times(). The caller must be
// signed in and own the application; at most one alert per 2 minutes per application.
//
// Secrets: RESEND_API_KEY; optional overrides MAIL_FROM, ADMIN_NOTIFY_EMAIL, APP_URL, BOOKING_LINK
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, highlight, layout, title, escape } from "../_shared/email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = (k: string) => Deno.env.get(k) ?? "";

const DEFAULTS: Record<string, string> = {
  MAIL_FROM: "Outreach <hello@consultation.outreachstudy.eu>",
  ADMIN_NOTIFY_EMAIL: "sbarakat@outreachrecruitment.net",
  APP_URL: "https://consultation.outreachstudy.eu",
  BOOKING_LINK: "https://calendar.app.google/FpLsWb5W5Q73v6JE7",
};
const setting = (k: string) => env(k) || DEFAULTS[k] || "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const malta = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(
    new Date(iso),
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { consultation_id } = await req.json().catch(() => ({}));
  if (typeof consultation_id !== "string") return json({ error: "consultation_id required" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Not signed in" }, 401);

  const { data: c, error } = await db.from("consultations").select("*").eq("id", consultation_id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const owns = c && (c.user_id === user.id || (user.email_confirmed_at && c.email === user.email?.toLowerCase()));
  if (!owns) return json({ error: "Not allowed" }, 403);
  if (!c.requested_call_times?.length) return json({ skipped: "no times" });

  // Throttle: claim the alert slot atomically.
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: claimed } = await db
    .from("consultations")
    .update({ call_alert_at: new Date().toISOString() })
    .eq("id", c.id)
    .or(`call_alert_at.is.null,call_alert_at.lt.${cutoff}`)
    .select("id")
    .maybeSingle();
  if (!claimed) return json({ skipped: "throttled" });
  if (!env("RESEND_API_KEY")) return json({ ok: true, email: "not-configured" });

  const first = c.full_name.split(" ")[0];
  const course = c.desired_course || "your studies";
  const times: string[] = c.requested_call_times.map(malta);
  const appUrl = setting("APP_URL");
  const digits = (c.whatsapp ?? "").replace(/\D/g, "");
  const reply = `Hi ${first}, this is Outreach. Thank you for your application for ${course} — we've reviewed your profile and would love to talk. Please confirm your free call here: ${setting("BOOKING_LINK")}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: setting("MAIL_FROM"),
      to: setting("ADMIN_NOTIFY_EMAIL"),
      subject: `Call request: ${c.full_name} — ${times.join(" / ")}`,
      html: layout(
        eyebrow("Call request") +
          title(`${escape(c.full_name)} asked for a call`) +
          highlight(`<strong style="font-size:18px">${times.map(escape).join("<br>")}</strong><br><span style="color:#8a8ea8;font-size:13px">Malta time</span>`) +
          facts([
            ["Course", course],
            ["Country", c.country],
            ["WhatsApp", c.whatsapp],
          ]) +
          actions(
            digits ? button(`https://wa.me/${digits}?text=${encodeURIComponent(reply)}`, "Send booking link", "#25D366") : "",
            button(`${appUrl}/admin/calendar`, "Open calendar"),
          ),
        `${c.full_name} requested ${times.join(" / ")}`,
      ),
    }),
  });
  return json({ ok: res.ok, email: res.ok ? "sent" : await res.text() });
});
