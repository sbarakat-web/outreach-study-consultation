// Email marketing campaigns (admin only):
//   POST { action: "count", segment, topic }        audience size + a few names
//   POST { action: "test", template, subject }      send the template to the signed-in admin
//   POST { action: "send", campaignId }             queue the campaign (now or scheduled, local morning, A/B)
//   POST { action: "cancel", campaignId }           stop a scheduled campaign
// Queued emails are sent by process-marketing-followups (hourly); due ones are sent right away.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { localMorning, loadSettings, prefsToken, processDueSends, renderFor, resolveSegment, sendMail, varsFor, type Segment } from "../_shared/marketing-send.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const email = auth?.user?.email_confirmed_at ? auth.user.email?.toLowerCase() : null;
  if (!email) return json({ error: "Not signed in" }, 401);
  const { data: admin } = await db.from("admins").select("email").eq("email", email).maybeSingle();
  if (!admin) return json({ error: "Admin access required" }, 403);

  const body = await req.json().catch(() => ({}));
  const topic = body.topic === "deadlines" ? "deadlines" : "news";

  if (body.action === "count") {
    const list = await resolveSegment(db, (body.segment ?? {}) as Segment, topic);
    return json({ count: list.length, sample: list.slice(0, 5).map((c) => c.full_name) });
  }

  if (body.action === "test") {
    const template = body.template ?? {};
    const { data: me } = await db.from("consultations").select("*").eq("email", email).limit(1).maybeSingle();
    const vars = me ? await varsFor(db, me) : { name: "Sofyane", course: "Bachelor in Business", country: "Malta", advisor: "Sofyane", call_date: "Monday 27 October, 14:00" };
    const settings = await loadSettings(db);
    const mail = renderFor(template, `[Test] ${body.subject ?? template.subject ?? ""}`, settings, vars as Record<string, string>, await prefsToken(db, email));
    const r = await sendMail(email, mail.subject, mail.html, mail.text, mail.unsubscribe);
    return r.ok ? json({ ok: true, to: email }) : json({ error: r.error }, 502);
  }

  const { data: camp } = await db.from("marketing_campaigns").select("*").eq("id", body.campaignId).maybeSingle();
  if (!camp) return json({ error: "Campaign not found" }, 404);

  if (body.action === "cancel") {
    await db.from("marketing_campaigns").update({ status: "cancelled" }).eq("id", camp.id);
    await db.from("marketing_sends").update({ status: "cancelled" }).eq("campaign_id", camp.id).eq("status", "pending");
    return json({ ok: true });
  }

  if (body.action === "send") {
    if (!["draft", "scheduled"].includes(camp.status)) return json({ error: "This campaign was already sent" }, 409);
    if (!camp.template_id) return json({ error: "Choose a template first" }, 400);
    const list = await resolveSegment(db, camp.segment ?? {}, camp.topic);
    if (!list.length) return json({ error: "No candidates match this audience" }, 400);
    const base = camp.scheduled_at && new Date(camp.scheduled_at) > new Date() ? new Date(camp.scheduled_at) : new Date();
    const rows = list.map((c, i) => ({
      campaign_id: camp.id,
      consultation_id: c.id,
      email: c.email,
      variant: camp.subject_b && i % 2 === 1 ? "b" : "a",
      send_after: (camp.local_morning ? localMorning(base, c.tracking?.tz) : base).toISOString(),
    }));
    const { error } = await db.from("marketing_sends").upsert(rows, { onConflict: "campaign_id,email", ignoreDuplicates: true });
    if (error) return json({ error: error.message }, 500);
    const later = rows.some((r) => new Date(r.send_after) > new Date());
    await db.from("marketing_campaigns").update({ status: later ? "scheduled" : "sending", recipients: rows.length }).eq("id", camp.id);
    const sentNow = await processDueSends(db, 150);
    return json({ ok: true, recipients: rows.length, sentNow, scheduled: rows.length - sentNow });
  }

  return json({ error: "Unknown action" }, 400);
});
