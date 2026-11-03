// The candidate books (or moves) their call from the dashboard calendar: confirmed instantly.
//   POST { consultationId, at }   signed-in owner of the application
// The time must be a real call slot that is still free (other calls + Google Calendar). Then the call is confirmed,
// put in the Google Calendar, the "We're waiting for you" email goes out (CC main admin) and the admins get an alert.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, layout, title, escape } from "../_shared/email.ts";
import { adminRecipients } from "../_shared/admins.ts";
import { APP_URL, sendEmail } from "../_shared/call.ts";
import { isCallSlot, isSlotFree } from "../_shared/slots.ts";
import { bookCall } from "../_shared/booked.ts";
import { gcalLink } from "../_shared/gcal.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const malta = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(iso));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Not signed in" }, 401);

  const { consultationId, at } = await req.json().catch(() => ({}));
  const { data: c } = await db.from("consultations").select("*").eq("id", consultationId).maybeSingle();
  const owns = c && (c.user_id === user.id || (user.email_confirmed_at && c.email === user.email?.toLowerCase()));
  if (!owns) return json({ error: "not-allowed" }, 403);
  if (typeof at !== "string" || !isCallSlot(at)) return json({ error: "invalid-time" }, 400);
  // A confirmed call can be moved here until 12h before it starts.
  if (c.call_status === "confirmed" && c.preferred_call_at && new Date(c.preferred_call_at).getTime() < Date.now() + 12 * 3_600_000) {
    return json({ error: "too-late" }, 409);
  }
  const own = c.google_event_id ? { preferred_call_at: c.call_status === "confirmed" ? c.preferred_call_at : c.suggested_call_at } : undefined;
  if (!(await isSlotFree(db, at, c.id, own))) return json({ error: "taken" }, 409);

  const previous = c.call_status === "confirmed" ? c.preferred_call_at : null;
  const r = await bookCall(db, c, new Date(at).toISOString(), "dashboard");
  if ("error" in r && r.error) return json({ error: r.error }, 500);
  const row = (r as { row: Record<string, string> }).row;
  const moved = (r as { moved: boolean }).moved;

  await sendEmail({
    to: await adminRecipients(db),
    subject: `${moved ? "🔁" : "📅"} ${row.full_name} ${moved ? "moved their call" : "booked a call"} — ${malta(row.preferred_call_at)}`,
    html: layout(
      eyebrow("Booked from the dashboard") +
        title(`${escape(row.full_name)} ${moved ? "moved their call" : "booked a call"}`) +
        facts([
          ["When", `${malta(row.preferred_call_at)} (Malta)`],
          ["Was", previous ? `${malta(previous)} (Malta)` : null],
          ["Course", row.desired_course],
          ["WhatsApp", row.whatsapp],
        ]) +
        actions(button(`${APP_URL()}/admin?lead=${row.id}`, "Open lead"), button(gcalLink(row, row.preferred_call_at), "📅 Add to Google Calendar", "#14123a")),
      `${row.full_name}: ${malta(row.preferred_call_at)}`,
    ),
  });
  return json({ ok: true, at: row.preferred_call_at, emailed: (r as { emailed: boolean }).emailed });
});
