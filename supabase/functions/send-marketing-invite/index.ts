import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { loadSettings, prefsToken, renderFor, sendMail } from "../_shared/marketing-send.ts";

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

  const { data: existingContact } = await db.from("marketing_contacts").select("status").eq("email", email).maybeSingle();
  const { data: pref } = await db.from("marketing_preferences").select("unsubscribed_at").eq("email", email).maybeSingle();
  if (existingContact?.status === "unsubscribed" || pref?.unsubscribed_at) return json({ error: "This candidate unsubscribed from marketing emails" }, 409);

  const { data: existingAccount } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingAccount?.users.some((user) => user.email?.toLowerCase() === email)) return json({ error: "This email already has an account" }, 409);

  const { data: template } = await db.from("marketing_email_templates").select("*").eq("id", "account-invite").maybeSingle();
  const { data: contact, error: upsertError } = await db.from("marketing_contacts").upsert({ full_name: fullName, email, created_by: auth.user.id, status: "draft", last_error: null, follow_up_count: 0, last_follow_up_at: null, next_follow_up_at: null }, { onConflict: "email" }).select("id, tracking_token, send_count").single();
  if (upsertError || !contact) return json({ error: upsertError?.message ?? "Could not save candidate" }, 500);

  const functionsUrl = `${env("SUPABASE_URL")}/functions/v1`;
  const clickUrl = `${functionsUrl}/marketing-track?token=${contact.tracking_token}&action=click`;
  const openUrl = `${functionsUrl}/marketing-track?token=${contact.tracking_token}&action=open`;
  const firstName = fullName.split(/\s+/)[0];
  // {signup_link} in the template's button goes through click tracking to the sign-up form.
  const mail = renderFor(
    template ?? { blocks: [{ id: "t", type: "text", text: "Create your free Outreach Study account." }, { id: "b", type: "button", label: "Create my free account", href: "{signup_link}" }] },
    template?.subject || "{name}, create your free Outreach Study account",
    await loadSettings(db),
    { name: firstName, signup_link: clickUrl },
    await prefsToken(db, email),
    undefined,
    openUrl,
  );
  const result = await sendMail(email, mail.subject, mail.html, mail.text, mail.unsubscribe);
  const sentAt = new Date();
  await db.from("marketing_contacts").update(result.ok ? { status: "sent", send_count: (contact.send_count || 0) + 1, last_sent_at: sentAt.toISOString(), next_follow_up_at: new Date(sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString(), provider_email_id: result.id ?? null, last_error: null } : { status: "failed", next_follow_up_at: null, last_error: result.error ?? "Email could not be sent" }).eq("id", contact.id);
  return result.ok ? json({ ok: true, id: contact.id }) : json({ error: result.error ?? "Email could not be sent" }, 502);
});
