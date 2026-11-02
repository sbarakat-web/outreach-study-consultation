// Welcome email for a new team member, sent by the Team page right after they are added (admin only).
//   POST { email, role: "admin" | "presenter" }
// Creates their sign-in account if needed and emails a one-click sign-in link (valid 1 hour),
// with replies going to the main admin.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, layout, para, title, escape } from "../_shared/email.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const OWNER = () => env("ADMIN_NOTIFY_EMAIL") || "sbarakat@outreachrecruitment.net";

const ROLES = {
  admin: {
    table: "admins",
    path: "/admin",
    label: "admin",
    intro: "You now have full admin access to the Outreach consultation platform.",
    can: [
      "See every lead, their details and uploaded documents",
      "Confirm calls, change statuses and add new leads",
      "Run online sessions and follow candidates to the next step",
      "Get the team email alerts (new leads, call requests, confirmed calls)",
    ],
  },
  presenter: {
    table: "session_presenters",
    path: "/onlinesessions?present=1",
    label: "online session presenter",
    intro: "You can now run online sessions on the Outreach consultation platform.",
    can: [
      "See booked candidates and their brief before each session",
      "Present the guided session and record the outcome",
      "Get an email 10 minutes before every session with a one-click link",
    ],
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const caller = auth?.user?.email?.toLowerCase();
  if (!caller) return json({ error: "Not signed in" }, 401);
  const { data: isAdmin } = await db.from("admins").select("email").eq("email", caller).maybeSingle();
  if (!isAdmin) return json({ error: "Admin access required" }, 403);

  const input = await req.json().catch(() => ({}));
  const email = String(input.email ?? "").trim().toLowerCase();
  const role = ROLES[input.role as keyof typeof ROLES];
  if (!role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "A valid email and role are required" }, 400);
  // Only welcome people who really are on the team list.
  const { data: member } = await db.from(role.table).select("email").eq("email", email).maybeSingle();
  if (!member) return json({ error: `${email} is not a ${role.label}` }, 404);

  // Sign-in account (sign-in is by emailed code; the link below signs them in directly).
  let link = await db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${APP_URL()}${role.path}` } });
  if (link.error) {
    await db.auth.admin.createUser({ email, email_confirm: true });
    link = await db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${APP_URL()}${role.path}` } });
  }
  const signIn = link.data?.properties?.action_link ?? `${APP_URL()}/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(role.path)}`;

  if (!env("RESEND_API_KEY")) return json({ error: "Email delivery is not configured" }, 503);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("STAFF_MAIL_FROM") || "Soufiane Barakat · Outreach <hello@consultation.outreachstudy.eu>",
      to: email,
      reply_to: OWNER(),
      subject: `Welcome to the Outreach team platform 👋`,
      html: layout(
        eyebrow("Welcome to the team") +
          title("Hello, this email is from Soufiane 👋") +
          para(`${escape(role.intro)} You were added as <strong>${escape(role.label)}</strong>.`, true) +
          `<div style="margin:0 0 18px;padding:16px 18px;border-radius:14px;background:#f0eeff;color:#14123a">
            <p style="margin:0 0 8px;font-weight:bold">What you can do</p>
            ${role.can.map((c) => `<p style="margin:0 0 4px;color:#5b6080;font-size:14px">✓ ${escape(c)}</p>`).join("")}
          </div>` +
          actions(button(signIn, "Open the platform")) +
          para(
            `The button signs you in once and works for 1 hour. After that, sign in at <a href="${APP_URL()}/login" style="color:#442DFA;font-weight:bold">consultation.outreachstudy.eu/login</a> with <strong>${escape(email)}</strong> — we email you a 6-digit code.`,
            true,
          ) +
          para(`Questions? Just reply to this email — it comes straight to me (${escape(OWNER())}).`, true),
        "Your access to the Outreach consultation platform",
        "en",
        { url: "https://outreachrecruitment.net", label: "outreachrecruitment.net", brand: "Outreach Recruitment — Study in Malta" },
      ),
    }),
  });
  return res.ok ? json({ ok: true }) : json({ error: `Email could not be sent (${res.status})` }, 502);
});
