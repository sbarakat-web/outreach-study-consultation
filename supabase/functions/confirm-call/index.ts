// One-click confirmation of the call time an admin suggested (public /confirm-call?t=… page).
//   POST { action: "get", token }      first name + suggested / confirmed time
//   POST { action: "confirm", token }  confirm the call, create the Google Meet event (when connected),
//                                      email the candidate and alert the admin
// The token is the secret (call_confirm_token); no sign-in needed. Opening the link never confirms,
// so email link scanners can't confirm by accident.
// Secrets: RESEND_API_KEY; optional Google (see _shared/google.ts), ADMIN_NOTIFY_EMAIL, APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, highlight, layout, title, escape } from "../_shared/email.ts";
import { APP_URL, CALL_MINUTES, confirmedEmail, loadAdvisor, sendEmail, tzOf } from "../_shared/call.ts";
import { createCallEvent, googleConfigured } from "../_shared/google.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const malta = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(iso));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { action, token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !UUID.test(token)) return json({ error: "invalid" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: c } = await db.from("consultations").select("*").eq("call_confirm_token", token).maybeSingle();
  if (!c) return json({ error: "invalid" }, 404);

  const view = (row: typeof c) => ({
    firstName: String(row.full_name).split(" ")[0],
    tz: tzOf(row),
    confirmed: row.call_status === "confirmed",
    at: row.call_status === "confirmed" ? row.preferred_call_at : row.suggested_call_at,
  });

  if (action === "get") return json(view(c));
  if (action !== "confirm") return json({ error: "Unknown action" }, 400);
  if (c.call_status === "confirmed") return json(view(c));
  if (!c.suggested_call_at) return json({ error: "no-suggestion" }, 409);
  if (new Date(c.suggested_call_at).getTime() < Date.now()) return json({ error: "expired" }, 410);

  const at = c.suggested_call_at;
  const { data: updated, error } = await db
    .from("consultations")
    .update({
      call_status: "confirmed",
      preferred_call_at: at,
      call_declined_at: null,
      reminder_24h_at: null,
      reminder_1h_at: null,
      ...(["new", "contacted", "qualified"].includes(c.status) ? { status: "consultation_booked" } : {}),
    })
    .eq("id", c.id)
    .neq("call_status", "confirmed")
    .select("*")
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!updated) return json(view(c)); // confirmed in parallel

  const meetUrl = googleConfigured() && !updated.google_event_id ? ((await createCallEvent(db, updated, at).catch(() => null)) as { meetUrl?: string | null } | null)?.meetUrl ?? null : null;
  const row = { ...updated, meeting_url: meetUrl ?? updated.meeting_url };

  const mail = confirmedEmail(row, await loadAdvisor(db, row.call_suggested_by));
  await sendEmail({ to: row.email, subject: mail.subject, html: mail.html, attachments: mail.attachments });
  await sendEmail({
    to: [...new Set([env("ADMIN_NOTIFY_EMAIL") || "sbarakat@outreachrecruitment.net", row.call_suggested_by].filter(Boolean))],
    subject: `✅ ${row.full_name} confirmed the call — ${malta(at)}`,
    html: layout(
      eyebrow("Call confirmed by candidate") +
        title(`${escape(row.full_name)} confirmed`) +
        highlight(`<strong style="font-size:18px">${escape(malta(at))}</strong><br><span style="color:#8a8ea8;font-size:13px">Malta time · ${CALL_MINUTES} minutes</span>`) +
        facts([
          ["Course", row.desired_course],
          ["WhatsApp", row.whatsapp],
          ["Google Meet", meetUrl ?? (row.meeting_url ? row.meeting_url : "Not created — add it in admin")],
        ]) +
        actions(button(`${APP_URL()}/admin?lead=${row.id}`, "Open lead"), button(`${APP_URL()}/admin/calendar`, "Open calendar", "#14123a")),
      `${row.full_name} confirmed ${malta(at)}`,
    ),
  });

  return json(view(row));
});
