// One-click sign-in for team members from a personal link (/loginnikki#k=<key>).
//   POST { key }  →  { token_hash }   the page then calls supabase.auth.verifyOtp({ token_hash, type: "magiclink" })
// The key is the secret (only its SHA-256 is stored in presenter_links). The link only works while
// the email is still an admin or session presenter and the link is not revoked.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { key } = await req.json().catch(() => ({}));
  if (typeof key !== "string" || key.length < 32 || key.length > 200) return json({ error: "invalid" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: link } = await db
    .from("presenter_links")
    .select("email")
    .eq("key_hash", await sha256(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (!link) return json({ error: "invalid" }, 403);

  const email = String(link.email).toLowerCase();
  const [{ data: admin }, { data: presenter }] = await Promise.all([
    db.from("admins").select("email").eq("email", email).maybeSingle(),
    db.from("session_presenters").select("email").eq("email", email).maybeSingle(),
  ]);
  if (!admin && !presenter) return json({ error: "invalid" }, 403);

  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) return json({ error: "link" }, 500);
  await db.from("presenter_links").update({ last_used_at: new Date().toISOString() }).eq("email", email);
  return json({ token_hash: data.properties.hashed_token });
});
