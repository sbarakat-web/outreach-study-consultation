import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, escape, eyebrow, highlight, layout, para, title } from "../_shared/email.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (key: string) => Deno.env.get(key) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth.user) return json({ error: "Not signed in" }, 401);
  const { data: admin } = await db.from("admins").select("email").eq("email", auth.user.email?.toLowerCase() ?? "").maybeSingle();
  if (!admin) return json({ error: "Admin access required" }, 403);

  const input = await req.json().catch(() => ({}));
  const fullName = String(input.full_name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!fullName || !emailPattern.test(email)) return json({ error: "A full name and valid email are required" }, 400);

  const { data: existingAccount } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingAccount?.users.some((user) => user.email?.toLowerCase() === email)) return json({ error: "This email already has an account" }, 409);

  const { data: template } = await db.from("marketing_email_templates").select("subject, body").eq("id", "account-invite").maybeSingle();
  const { data: contact, error: upsertError } = await db.from("marketing_contacts").upsert({ full_name: fullName, email, created_by: auth.user.id, status: "draft", last_error: null, follow_up_count: 0, last_follow_up_at: null, next_follow_up_at: null }, { onConflict: "email" }).select("id, tracking_token, send_count").single();
  if (upsertError || !contact) return json({ error: upsertError?.message ?? "Could not save candidate" }, 500);

  const appUrl = env("APP_URL") || "https://consultation.outreachstudy.eu";
  const functionsUrl = `${env("SUPABASE_URL")}/functions/v1`;
  const clickUrl = `${functionsUrl}/marketing-track?token=${contact.tracking_token}&action=click`;
  const openUrl = `${functionsUrl}/marketing-track?token=${contact.tracking_token}&action=open`;
  const firstName = fullName.split(/\s+/)[0];
  const subject = (template?.subject || "{name}, create your free Outreach Study account").replaceAll("{name}", firstName);
  const message = (template?.body || "Your personal account keeps your Malta study consultation, documents and next steps together in one secure place.").replaceAll("{name}", firstName);
  const html = layout(
    eyebrow("Your Malta study journey") +
      title(`Welcome, ${escape(firstName)}`) +
      `<img src="${appUrl}/onlinesessions/online-session-hero-v2.webp" alt="Study in Malta" width="504" style="display:block;width:100%;height:auto;border-radius:14px;margin:0 0 18px">` +
      para(escape(message), true) +
      highlight("<strong>One account for your consultation, documents and personalised next steps.</strong>") +
      actions(button(clickUrl, "Create my free account", "#28A77A")) +
      para("It takes about two minutes. If you need help, reply to this email and our team will guide you.", true) +
      `<img src="${openUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`,
    `Create your Outreach Study account and continue your Malta journey.`,
  );

  const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env("MAIL_FROM") || "Outreach Study <hello@consultation.outreachstudy.eu>", to: email, reply_to: "study@outreachrecruitment.net", subject, html }) });
  const result = await sent.json().catch(() => ({}));
  const sentAt = new Date();
  await db.from("marketing_contacts").update(sent.ok ? { status: "sent", send_count: (contact.send_count || 0) + 1, last_sent_at: sentAt.toISOString(), next_follow_up_at: new Date(sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString(), provider_email_id: result.id ?? null, last_error: null } : { status: "failed", next_follow_up_at: null, last_error: result.message ?? `Email provider returned ${sent.status}` }).eq("id", contact.id);
  return sent.ok ? json({ ok: true, id: contact.id }) : json({ error: result.message ?? "Email could not be sent" }, 502);
});
