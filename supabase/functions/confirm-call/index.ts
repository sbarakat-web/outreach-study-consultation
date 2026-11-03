// Call link from the candidate's email / WhatsApp (public /confirm-call?t=…).
//   POST { action: "get", token }             first name, time, whether it is confirmed / awaiting confirmation
//   POST { action: "confirm", token }         accept the suggested time → awaiting confirmation by the team
//   POST { action: "reschedule", token, at }  pick another free time → awaiting confirmation by the team
//                                             (also changes an already-confirmed call, ≥ 12h ahead)
// The team then confirms in admin with the Google Meet link (see _shared/booked.ts).
// The token is the secret (call_confirm_token); no sign-in needed. Opening the link never changes anything.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { tzOf } from "../_shared/call.ts";
import { requestCall } from "../_shared/booked.ts";
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

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const view = (row: Row) => {
  const confirmed = row.call_status === "confirmed";
  const pending = row.call_status === "requested" && !!row.preferred_call_at;
  const at = confirmed || pending ? row.preferred_call_at : row.suggested_call_at;
  return {
    firstName: String(row.full_name).split(" ")[0],
    tz: tzOf(row),
    confirmed,
    pending,
    at,
    meetingUrl: confirmed ? row.meeting_url : null,
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
  if (action === "confirm") {
    if (c.call_status === "confirmed" || view(c).pending) return json(view(c));
    if (!c.suggested_call_at) return json({ error: "no-suggestion" }, 409);
    if (new Date(c.suggested_call_at).getTime() < Date.now()) return json({ error: "expired" }, 410);
    if (!(await isSlotFree(db, c.suggested_call_at, c.id))) return json({ error: "taken" }, 409);
    at = c.suggested_call_at;
  } else if (action === "reschedule") {
    if (typeof picked !== "string" || !isCallSlot(picked)) return json({ error: "invalid-time" }, 400);
    if (!view(c).canReschedule) return json({ error: "too-late" }, 409);
    if (!(await isSlotFree(db, picked, c.id))) return json({ error: "taken" }, 409);
    at = new Date(picked).toISOString();
  } else {
    return json({ error: "Unknown action" }, 400);
  }

  const r = await requestCall(db, c, at, "confirm-link");
  if ("error" in r && r.error) return json({ error: r.error }, 500);
  return json(view((r as { row: Row }).row));
});
