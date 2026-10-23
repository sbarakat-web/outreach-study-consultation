import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, highlight, layout, para, title, escape } from "../_shared/email.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (key: string) => Deno.env.get(key) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const statuses = {
  new: {
    label: "New lead",
    subject: "We received your Malta study application",
    message: "Your application has been added to our review queue.",
    action: "Open your dashboard to review your information and follow your next steps.",
  },
  consultation_booked: {
    label: "Consultation booked",
    subject: "Your Outreach Study consultation is booked",
    message: "Your consultation has been added to your application.",
    action: "Open your dashboard to review your consultation and prepare for the call.",
  },
  interviewed: {
    label: "Interviewed",
    subject: "Your consultation is complete – next steps",
    message: "Your consultation has been completed and your application is moving forward.",
    action: "Open your dashboard and upload the required documents for your chosen course.",
  },
  no_show: {
    label: "No-show",
    subject: "We missed you – choose another consultation time",
    message: "We recorded that your scheduled consultation was not attended.",
    action: "Open your dashboard to request another consultation time.",
  },
  not_interested: {
    label: "No longer interested",
    subject: "Your Outreach Study application status",
    message: "Your application is currently marked as no longer interested.",
    action: "If this is incorrect or you want to continue, open your dashboard and contact our team.",
  },
} as const;

type LeadStatus = keyof typeof statuses;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const adminEmail = auth.user?.email?.toLowerCase() ?? "";
  if (!auth.user || !adminEmail) return json({ error: "Not signed in" }, 401);
  const { data: admin } = await db.from("admins").select("email").eq("email", adminEmail).maybeSingle();
  if (!admin) return json({ error: "Admin access required" }, 403);

  const input = await req.json().catch(() => ({}));
  const fullName = String(input.full_name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const status = String(input.status ?? "new") as LeadStatus;
  if (fullName.length < 2 || !emailPattern.test(email)) return json({ error: "A full name and valid email are required" }, 400);
  if (!statuses[status]) return json({ error: "Select a valid lead status" }, 400);

  const { data: existing } = await db.from("consultations").select("id, full_name").eq("email", email).limit(1).maybeSingle();
  if (existing) return json({ error: `This email already belongs to ${existing.full_name}` }, 409);

  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page += 1) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    userId = data?.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
    if (!data || data.users.length < 1000) break;
  }
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error || !data.user) return json({ error: error?.message ?? "Could not create the candidate account" }, 500);
    userId = data.user.id;
  }

  const interviewed = status === "interviewed";
  const { data: consultation, error: insertError } = await db
    .from("consultations")
    .insert({
      user_id: userId,
      full_name: fullName,
      email,
      status,
      session_outcome: interviewed ? "interviewed" : null,
      session_outcome_at: interviewed ? new Date().toISOString() : null,
      documents_due_at: interviewed ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
      tracking: { source: "admin", created_by: adminEmail },
    })
    .select("id")
    .single();
  if (insertError || !consultation) return json({ error: insertError?.message ?? "Could not save the lead" }, 500);

  const appUrl = env("APP_URL") || "https://consultation.outreachstudy.eu";
  const link = await db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${appUrl}/dashboard` } });
  const dashboardLink = link.data?.properties?.action_link || `${appUrl}/login?email=${encodeURIComponent(email)}&next=%2Fdashboard`;
  const detail = statuses[status];
  const firstName = escape(fullName.split(/\s+/)[0]);

  if (env("RESEND_API_KEY")) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>",
        to: email,
        subject: detail.subject,
        html: layout(
          eyebrow("Application update") +
            title(`Hi ${firstName}`) +
            para(detail.message, true) +
            highlight(`<span style="font-size:12px;color:#5b6080;text-transform:uppercase">Current status</span><br><strong style="font-size:18px">${escape(detail.label)}</strong>`) +
            para(detail.action, true) +
            actions(button(dashboardLink, "Open my dashboard")),
          detail.subject,
        ),
      }),
    });
    if (!response.ok) return json({ error: "The lead was added, but the status email could not be sent", id: consultation.id }, 502);
  }

  return json({ ok: true, id: consultation.id });
});
