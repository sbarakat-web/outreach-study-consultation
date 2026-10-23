// Public "Manage email preferences" endpoint (token from the email footer, no sign-in).
//   POST { token }                                   current choices
//   POST { token, news, deadlines, unsubscribe }     save choices
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;
// a***@example.com
const mask = (e: string) => e.replace(/^(.)[^@]*/, "$1***");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  if (typeof body.token !== "string" || !UUID.test(body.token)) return json({ error: "invalid" }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  let { data: p } = await db.from("marketing_preferences").select("*").eq("token", body.token).maybeSingle();
  if (!p) return json({ error: "invalid" }, 404);

  if ("news" in body || "unsubscribe" in body) {
    const now = new Date().toISOString();
    const unsubscribe = body.unsubscribe === true || (body.news === false && body.deadlines === false);
    const { data } = await db
      .from("marketing_preferences")
      .update({ news: body.news !== false, deadlines: body.deadlines !== false, unsubscribed_at: unsubscribe ? now : null, updated_at: now })
      .eq("token", body.token)
      .select("*")
      .single();
    p = data;
    if (unsubscribe) await db.from("marketing_contacts").update({ status: "unsubscribed", unsubscribed_at: now, next_follow_up_at: null }).eq("email", p.email).neq("status", "account_created");
  }
  return json({ email: mask(p.email), news: p.news, deadlines: p.deadlines, unsubscribed: !!p.unsubscribed_at });
});
