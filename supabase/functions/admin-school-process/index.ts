// Create a manual School / Visa Process record. Admin only; deliberately sends nothing and creates no login account.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (key: string) => Deno.env.get(key) ?? "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const statuses = new Set(["reviewing", "fee_paid", "approved", "not_approved"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const adminEmail = auth.user?.email_confirmed_at ? auth.user.email?.toLowerCase() : null;
  if (!adminEmail) return json({ error: "Not signed in" }, 401);
  const { data: admin } = await db.from("admins").select("email").eq("email", adminEmail).maybeSingle();
  if (!admin) return json({ error: "Admin access required" }, 403);

  const input = await req.json().catch(() => ({}));
  const fullName = String(input.full_name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp ?? "").trim().slice(0, 40);
  const appliedDate = String(input.applied_date ?? "");
  const status = String(input.status ?? "reviewing");
  const comment = String(input.comment ?? "").trim();
  if (fullName.length < 2 || !emailPattern.test(email)) return json({ error: "A full name and valid email are required" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedDate)) return json({ error: "Select a valid applied date" }, 400);
  if (!statuses.has(status)) return json({ error: "Select a valid status" }, 400);

  const { data, error } = await db
    .from("consultations")
    .insert({
      full_name: fullName,
      email,
      whatsapp,
      status: "interviewed",
      admin_notes: comment || null,
      tracking: {
        source: "school_visa_process",
        school_applied_date: appliedDate,
        school_status: status,
        manual_only: "true",
        created_by: adminEmail,
        school_comment_updated_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id: data.id });
});
