import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, highlight, layout, para, steps, title, escape } from "../_shared/email.ts";
import { CALL_MINUTES, confirmedEmail, whenIn } from "../_shared/call.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (key: string) => Deno.env.get(key) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP = "35699728213";
const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const optional = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** "Consultation booked" with a meeting set up outside the app: local + Malta time, link, programme, dashboard, cancel note. */
// deno-lint-ignore no-explicit-any
function bookedEmail(c: any, dashboardLink: string) {
  const first = escape(String(c.full_name).split(/\s+/)[0]);
  const when = whenIn(c.preferred_call_at, c.tracking.tz);
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi Outreach, this is ${c.full_name}. About my meeting on ${when.short}: `)}`;
  return {
    subject: `${String(c.full_name).split(/\s+/)[0]}, you have a meeting with Outreach — ${when.short}`,
    html: layout(
      eyebrow("Consultation booked") +
        title(`Hi ${first}, you have a meeting with us 🎓`) +
        para("Your free online consultation with Outreach is booked. Here are your details:", true) +
        highlight(
          `<strong style="font-size:18px">📅 ${escape(when.main)}</strong><br><span style="color:#8a8ea8;font-size:13px">${escape(when.sub)} · ${CALL_MINUTES} minutes · online</span>`,
        ) +
        actions(button(c.meeting_url, "🎥 Join the meeting")) +
        facts([
          ["Programme", c.desired_course],
          ["Meeting link", c.meeting_url],
        ]) +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px;text-align:center">
          <p style="margin:0 0 6px;color:#14123a"><strong>Your new dashboard</strong></p>
          <p style="margin:0 0 12px;color:#5b6080">Follow every step of your application in one place: your meeting, documents to upload and what comes next.</p>
          ${button(dashboardLink, "Open my dashboard", "#14123a")}
        </div>` +
        steps("What happens next", ["Join the meeting", "Upload your documents", "Follow your next steps"]) +
        `<p style="margin:0 0 14px;padding:12px 16px;border-radius:12px;background:#fff8e6;color:#7a5a00;text-align:center;font-size:14px">Need to cancel or change the time? Please <a href="${wa}" style="color:#7a5a00;font-weight:bold">send us a WhatsApp message</a> (+356 9972 8213) before the meeting.</p>` +
        para(`The calendar invite is attached. The dashboard button signs you in for 1 hour; after that, sign in with your email at <a href="${env("APP_URL") || "https://consultation.outreachstudy.eu"}/login" style="color:#442DFA">consultation.outreachstudy.eu</a>.`, true),
      `${when.main} — your meeting with Outreach`,
    ),
  };
}

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
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let consultationId: string | undefined;
  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Lead creation is not configured");
    const db = createClient(supabaseUrl, serviceRoleKey);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth, error: authError } = await db.auth.getUser(jwt);
    const adminEmail = auth.user?.email?.toLowerCase() ?? "";
    if (authError || !auth.user || !adminEmail) return json({ error: "Not signed in" }, 401);
    const { data: admin, error: adminError } = await db.from("admins").select("email").eq("email", adminEmail).maybeSingle();
    if (adminError) throw new Error("Could not verify admin access");
    if (!admin) return json({ error: "Admin access required" }, 403);

    const input = await req.json().catch(() => ({}));
    const fullName = String(input.full_name ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();
    const status = String(input.status ?? "new") as LeadStatus;
    if (fullName.length < 2 || !emailPattern.test(email)) return json({ error: "A full name and valid email are required" }, 400);
    if (!statuses[status]) return json({ error: "Select a valid lead status" }, 400);
    const booked = status === "consultation_booked" && !!input.call_at;
    const callAt = booked ? new Date(String(input.call_at)) : null;
    const meetingUrl = booked ? String(input.meeting_url ?? "").trim() : null;
    const tz = booked && validZone(String(input.tz ?? "")) ? String(input.tz) : "Europe/Malta";
    if (booked) {
      if (!callAt || Number.isNaN(callAt.getTime()) || callAt.getTime() < Date.now()) return json({ error: "Choose a meeting time in the future" }, 400);
      if (!/^https:\/\/\S+$/.test(meetingUrl ?? "")) return json({ error: "The meeting link must start with https://" }, 400);
    }
    if (!env("RESEND_API_KEY")) return json({ error: "Email delivery is not configured; no lead was created" }, 503);

    const { data: existing, error: lookupError } = await db
      .from("consultations")
      .select("id, full_name")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new Error("Could not check whether this email already exists");
    if (existing) return json({ error: `This email already belongs to ${existing.full_name}` }, 409);

    let userId: string | null = null;
    for (let page = 1; !userId; page += 1) {
      const { data, error: usersError } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) throw new Error("Could not check for an existing candidate account");
      userId = data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
      if (userId || data.users.length < 1000) break;
    }
    if (!userId) {
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
      if (error || !data.user) throw new Error(error?.message ?? "Could not create the candidate account");
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
        country: optional(input.country, 80),
        whatsapp: optional(input.whatsapp, 40) ?? "",
        desired_course: optional(input.desired_course, 300),
        ...(input.study_path === "english" || input.study_path === "higher_education" ? { study_path: input.study_path } : {}),
        ...(booked
          ? {
              call_status: "confirmed",
              preferred_call_at: callAt!.toISOString(),
              meeting_url: meetingUrl,
              // This email already confirms the meeting; skip the "see you tomorrow" reminder when it is that close.
              reminder_24h_at: callAt!.getTime() - Date.now() < 25 * 3_600_000 ? new Date().toISOString() : null,
            }
          : {}),
        session_outcome: interviewed ? "interviewed" : null,
        session_outcome_at: interviewed ? new Date().toISOString() : null,
        documents_due_at: interviewed ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
        tracking: { source: "admin", created_by: adminEmail, tz },
      })
      .select("*")
      .single();
    if (insertError || !consultation) throw new Error(insertError?.message ?? "Could not save the lead");
    consultationId = consultation.id;

    const appUrl = env("APP_URL") || "https://consultation.outreachstudy.eu";
    const link = await db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: `${appUrl}/dashboard` } });
    const dashboardLink = link.data?.properties?.action_link;
    if (link.error || !dashboardLink) {
      return json({ error: "Lead was added, but its secure dashboard link could not be created", id: consultation.id }, 502);
    }
    const detail = statuses[status];
    const firstName = escape(fullName.split(/\s+/)[0]);

    const meeting = booked ? bookedEmail(consultation, dashboardLink) : null;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>",
        to: email,
        ...(meeting ? { attachments: confirmedEmail(consultation).attachments } : {}),
        subject: meeting?.subject ?? detail.subject,
        html: meeting?.html ?? layout(
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
    if (!response.ok) return json({ error: "Lead was added, but the status email could not be sent", id: consultation.id }, 502);

    return json({ ok: true, id: consultation.id });
  } catch (error) {
    console.error("admin-create-lead failed", error);
    const message = error instanceof Error ? error.message : "Could not create the lead";
    return json({ error: consultationId ? `Lead was added, but follow-up failed: ${message}` : message, ...(consultationId ? { id: consultationId } : {}) }, consultationId ? 502 : 500);
  }
});
