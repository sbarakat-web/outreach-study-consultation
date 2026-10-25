// Account invitations (admin only):
//   POST { full_name, email }                                        send one invitation now
//   POST { action: "queue", contacts: [{ full_name, email }], interval_minutes, start_at? }
//        queue many (CSV); sent one by one, interval_minutes apart, by process-marketing-followups
//   POST { action: "cancel", ids? }                                  cancel queued invitations (all when no ids)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { processInviteQueue, sendInvite } from "../_shared/invite.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (key: string) => Deno.env.get(key) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QUEUE = 1000;

// deno-lint-ignore no-explicit-any
async function accountEmails(db: any) {
  const out = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const user of users) if (user.email) out.add(user.email.toLowerCase());
    if (users.length < 1000) break;
  }
  return out;
}

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

  if (input.action === "cancel") {
    let query = db.from("marketing_contacts").update({ status: "cancelled", scheduled_at: null }).eq("status", "queued");
    if (Array.isArray(input.ids) && input.ids.length) query = query.in("id", input.ids);
    const { data, error } = await query.select("id");
    return error ? json({ error: error.message }, 500) : json({ ok: true, cancelled: data?.length ?? 0 });
  }

  if (input.action === "queue") {
    const interval = Math.round(Number(input.interval_minutes));
    if (!(interval >= 1 && interval <= 1440)) return json({ error: "Time between emails must be 1–1440 minutes" }, 400);
    const startAt = input.start_at ? new Date(input.start_at) : new Date();
    if (Number.isNaN(startAt.getTime())) return json({ error: "Invalid start time" }, 400);
    const start = startAt < new Date() ? new Date() : startAt;

    const skipped: { email: string; reason: string }[] = [];
    const seen = new Set<string>();
    const list: { full_name: string; email: string }[] = [];
    for (const raw of Array.isArray(input.contacts) ? input.contacts : []) {
      const email = String(raw?.email ?? "").trim().toLowerCase();
      const fullName = String(raw?.full_name ?? "").trim() || email.split("@")[0];
      if (!emailPattern.test(email)) skipped.push({ email: email || "(empty)", reason: "Invalid email" });
      else if (seen.has(email)) skipped.push({ email, reason: "Duplicate in the list" });
      else {
        seen.add(email);
        list.push({ full_name: fullName.slice(0, 120), email });
      }
    }
    if (list.length > MAX_QUEUE) return json({ error: `At most ${MAX_QUEUE} candidates per upload` }, 400);

    const accounts = await accountEmails(db);
    const emails = list.map((c) => c.email);
    const { data: existing } = await db.from("marketing_contacts").select("email, status, send_count").in("email", emails);
    const { data: prefs } = await db.from("marketing_preferences").select("email, unsubscribed_at").in("email", emails).not("unsubscribed_at", "is", null);
    const known = new Map((existing ?? []).map((c) => [c.email, c]));
    const unsubscribed = new Set((prefs ?? []).map((p) => p.email));
    const ready = list.filter((c) => {
      const prev = known.get(c.email);
      const reason = accounts.has(c.email)
        ? "Already has an account"
        : unsubscribed.has(c.email) || prev?.status === "unsubscribed"
          ? "Unsubscribed"
          : prev && ["queued", "sending"].includes(prev.status)
            ? "Already in the queue"
            : prev && prev.send_count > 0 && !input.resend
              ? "Already invited"
              : "";
      if (reason) skipped.push({ email: c.email, reason });
      return !reason;
    });
    if (!ready.length) return json({ ok: true, queued: 0, skipped });

    const batchId = crypto.randomUUID();
    const rows = ready.map((c, i) => ({
      full_name: c.full_name,
      email: c.email,
      created_by: auth.user!.id,
      status: "queued",
      batch_id: batchId,
      send_interval_minutes: interval,
      scheduled_at: new Date(start.getTime() + i * interval * 60_000).toISOString(),
      last_error: null,
      follow_up_count: 0,
      last_follow_up_at: null,
      next_follow_up_at: null,
    }));
    const { error } = await db.from("marketing_contacts").upsert(rows, { onConflict: "email" });
    if (error) return json({ error: error.message }, 500);
    const sentNow = await processInviteQueue(db);
    return json({ ok: true, queued: rows.length, sentNow, skipped, first_at: rows[0].scheduled_at, last_at: rows[rows.length - 1].scheduled_at });
  }

  // One invitation, sent now.
  const fullName = String(input.full_name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!fullName || !emailPattern.test(email)) return json({ error: "A full name and valid email are required" }, 400);

  const { data: existingContact } = await db.from("marketing_contacts").select("status").eq("email", email).maybeSingle();
  const { data: pref } = await db.from("marketing_preferences").select("unsubscribed_at").eq("email", email).maybeSingle();
  if (existingContact?.status === "unsubscribed" || pref?.unsubscribed_at) return json({ error: "This candidate unsubscribed from marketing emails" }, 409);
  if ((await accountEmails(db)).has(email)) return json({ error: "This email already has an account" }, 409);

  const { data: contact, error: upsertError } = await db
    .from("marketing_contacts")
    .upsert({ full_name: fullName, email, created_by: auth.user.id, status: "sending", batch_id: null, scheduled_at: null, last_error: null, follow_up_count: 0, last_follow_up_at: null, next_follow_up_at: null }, { onConflict: "email" })
    .select("*")
    .single();
  if (upsertError || !contact) return json({ error: upsertError?.message ?? "Could not save candidate" }, 500);

  const result = await sendInvite(db, contact);
  return result.ok ? json({ ok: true, id: contact.id }) : json({ error: result.error ?? "Email could not be sent" }, 502);
});
