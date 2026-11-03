// One-click call confirmation from the candidate's email / WhatsApp link (public /confirm-call?t=…).
//   POST { action: "get", token }             first name, suggested / confirmed time, whether it can still change
//   POST { action: "confirm", token }         confirm the suggested time (re-checked against Google Calendar)
//   POST { action: "reschedule", token, at }  candidate picks another free time → confirmed immediately
//                                             (also moves an already-confirmed call, ≥ 12h ahead)
// Every confirmation creates or moves the Google Calendar event, emails the candidate and alerts the admin.
// The token is the secret (call_confirm_token); no sign-in needed. Opening the link never confirms.
// Secrets: RESEND_API_KEY; optional Google (see _shared/google.ts), ADMIN_NOTIFY_EMAIL, APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, highlight, layout, title, escape } from "../_shared/email.ts";
import { adminRecipients } from "../_shared/admins.ts";
import { APP_URL, CALL_MINUTES, sendEmail, tzOf } from "../_shared/call.ts";
import { googleConfigured } from "../_shared/google.ts";
import { bookCall } from "../_shared/booked.ts";
import { gcalLink } from "../_shared/gcal.ts";
import { isCallSlot, isSlotFree } from "../_shared/slots.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const H = 3_600_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const malta = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(iso));

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const view = (row: Row) => {
  const confirmed = row.call_status === "confirmed";
  const at = confirmed ? row.preferred_call_at : row.suggested_call_at;
  return {
    firstName: String(row.full_name).split(" ")[0],
    tz: tzOf(row),
    confirmed,
    at,
    // A confirmed call can still be moved until 12h before it starts.
    canReschedule: !confirmed || (!!at && new Date(at).getTime() > Date.now() + 12 * H),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { action, token, at: picked } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !UUID.test(token)) return json({ error: "invalid" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: c } = await db.from("consultations").select("*").eq("call_confirm_token", token).maybeSingle();
  if (!c) return json({ error: "invalid" }, 404);

  if (action === "get") return json(view(c));

  let at: string;
  let kind: "confirmed" | "picked" | "moved";
  // The candidate's own tentative hold / confirmed event doesn't count as busy.
  const own = c.google_event_id ? { preferred_call_at: c.call_status === "confirmed" ? c.preferred_call_at : c.suggested_call_at } : undefined;
  if (action === "confirm") {
    if (c.call_status === "confirmed") return json(view(c));
    if (!c.suggested_call_at) return json({ error: "no-suggestion" }, 409);
    if (new Date(c.suggested_call_at).getTime() < Date.now()) return json({ error: "expired" }, 410);
    if (!(await isSlotFree(db, c.suggested_call_at, c.id, own))) return json({ error: "taken" }, 409);
    at = c.suggested_call_at;
    kind = "confirmed";
  } else if (action === "reschedule") {
    if (typeof picked !== "string" || !isCallSlot(picked)) return json({ error: "invalid-time" }, 400);
    if (!view(c).canReschedule) return json({ error: "too-late" }, 409);
    const moving = c.call_status === "confirmed";
    if (!(await isSlotFree(db, picked, c.id, own))) return json({ error: "taken" }, 409);
    at = new Date(picked).toISOString();
    kind = moving ? "moved" : "picked";
  } else {
    return json({ error: "Unknown action" }, 400);
  }

  const previous = c.preferred_call_at;
  // Confirm, put it in (or move it in) the Google Calendar and send the "We're waiting for you" email.
  const booked = await bookCall(db, c, at, "confirm-link");
  if ("error" in booked && booked.error) return json({ error: booked.error }, 500);
  const row = (booked as { row: Row }).row;

  const headline = { confirmed: "confirmed the call", picked: "picked a time — call confirmed", moved: "moved the call" }[kind];
  await sendEmail({
    to: [...new Set([...(await adminRecipients(db)), row.call_suggested_by].filter(Boolean))],
    subject: `${kind === "moved" ? "🔁" : "✅"} ${row.full_name} ${headline} — ${malta(at)}`,
    html: layout(
      eyebrow(kind === "moved" ? "Call moved by candidate" : "Call confirmed by candidate") +
        title(`${escape(row.full_name)} ${escape(headline)}`) +
        highlight(
          (kind === "moved" && previous ? `<span style="color:#8a8ea8;text-decoration:line-through;font-size:14px">${escape(malta(previous))}</span><br>` : "") +
            `<strong style="font-size:18px">${escape(malta(at))}</strong><br><span style="color:#8a8ea8;font-size:13px">Malta time · ${CALL_MINUTES} minutes${googleConfigured() ? " · in your Google Calendar" : ""}</span>`,
        ) +
        facts([
          ["Course", row.desired_course],
          ["WhatsApp", row.whatsapp],
          ["Google Meet", row.meeting_url ?? "Not created — add it in admin"],
        ]) +
        actions(button(`${APP_URL()}/admin?lead=${row.id}`, "Open lead"), button(gcalLink(row, at), "📅 Add to Google Calendar", "#14123a")),
      `${row.full_name} ${headline}: ${malta(at)}`,
    ),
  });

  return json(view(row));
});
