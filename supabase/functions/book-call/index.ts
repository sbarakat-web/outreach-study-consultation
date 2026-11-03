// The candidate requests (or changes) their call time from the dashboard calendar.
//   POST { consultationId, at }   signed-in owner of the application
// The time must be a real call slot that is still free (other calls and requests + Google Calendar). It is held as
// "Awaiting confirmation": the candidate gets "request received", the admins an alert with the steps to confirm.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { isCallSlot, isSlotFree } from "../_shared/slots.ts";
import { requestCall } from "../_shared/booked.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
  // A confirmed call can be changed here until 12h before it starts.
  if (c.call_status === "confirmed" && c.preferred_call_at && new Date(c.preferred_call_at).getTime() < Date.now() + 12 * 3_600_000) {
    return json({ error: "too-late" }, 409);
  }
  if (!(await isSlotFree(db, at, c.id))) return json({ error: "taken" }, 409);

  const r = await requestCall(db, c, new Date(at).toISOString(), "dashboard");
  if ("error" in r && r.error) return json({ error: r.error }, 500);
  return json({ ok: true, at: new Date(at).toISOString(), pending: true });
});
