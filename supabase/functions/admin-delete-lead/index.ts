import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (key: string) => Deno.env.get(key) ?? "";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Lead deletion is not configured");
    const db = createClient(supabaseUrl, serviceRoleKey);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Sign in as an admin to delete a lead" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(jwt);
    const adminEmail = auth.user?.email?.toLowerCase() ?? "";
    if (authError || !auth.user || !adminEmail) return json({ error: "Not signed in" }, 401);

    const { data: admin, error: adminError } = await db.from("admins").select("email").eq("email", adminEmail).maybeSingle();
    if (adminError) throw new Error("Could not verify admin access");
    if (!admin) return json({ error: "Admin access required" }, 403);

    const input = await req.json().catch(() => ({}));
    const consultationId = String(input.consultationId ?? "");
    if (!uuidPattern.test(consultationId)) return json({ error: "A valid lead ID is required" }, 400);

    const { data: lead, error: leadError } = await db
      .from("consultations")
      .select("id, email, user_id")
      .eq("id", consultationId)
      .maybeSingle();
    if (leadError) throw new Error("Could not load the lead");
    if (!lead) return json({ error: "Lead not found; it may already have been deleted" }, 404);
    const email = lead.email.toLowerCase();

    const { data: protectedAdmin, error: protectedAdminError } = await db
      .from("admins")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (protectedAdminError) throw new Error("Could not check whether this account has an admin role");
    if (protectedAdmin) return json({ error: "This email belongs to an admin account and cannot be removed as a lead" }, 409);
    const { data: protectedPresenter, error: protectedPresenterError } = await db
      .from("session_presenters")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (protectedPresenterError) throw new Error("Could not check whether this account has a presenter role");
    if (protectedPresenter) return json({ error: "This email belongs to a session presenter and cannot be removed as a lead" }, 409);

    let candidateUserId: string | null = lead.user_id;
    if (candidateUserId) {
      const { data, error } = await db.auth.admin.getUserById(candidateUserId);
      if (error) throw new Error("Could not verify the lead's linked login account");
      if (data.user.email?.toLowerCase() !== email) {
        return json({ error: "The lead's linked login email does not match; no data was deleted" }, 409);
      }
    } else {
      for (let page = 1; !candidateUserId; page += 1) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw new Error("Could not check for a login account linked to this lead");
        candidateUserId = data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
        if (candidateUserId || data.users.length < 1000) break;
      }
    }

    const { data: documents, error: documentsError } = await db
      .from("documents")
      .select("file_path, user_id")
      .eq("consultation_id", consultationId);
    if (documentsError) throw new Error("Could not load the lead's uploaded documents");

    const ownerIds = new Set((documents ?? []).map((document) => document.user_id));
    if (candidateUserId) ownerIds.add(candidateUserId);
    if (lead.user_id) ownerIds.add(lead.user_id);
    const filePaths = new Set((documents ?? []).map((document) => document.file_path));
    for (const ownerId of ownerIds) {
      let offset = 0;
      while (true) {
        const { data: files, error } = await db.storage
          .from("documents")
          .list(`${ownerId}/${consultationId}`, { limit: 1000, offset });
        if (error) throw new Error(`Could not list uploaded documents: ${error.message}`);
        for (const file of files ?? []) {
          if (file.id) filePaths.add(`${ownerId}/${consultationId}/${file.name}`);
        }
        if (!files || files.length < 1000) break;
        offset += 1000;
      }
    }

    const paths = [...filePaths];
    for (let start = 0; start < paths.length; start += 1000) {
      const { error } = await db.storage.from("documents").remove(paths.slice(start, start + 1000));
      if (error) throw new Error(`Could not remove uploaded documents: ${error.message}`);
    }

    const { error: sendsByLeadError } = await db.from("marketing_sends").delete().eq("consultation_id", consultationId);
    if (sendsByLeadError) throw new Error("Could not remove the lead's email send history");
    const { error: sendsByEmailError } = await db.from("marketing_sends").delete().eq("email", email);
    if (sendsByEmailError) throw new Error("Could not remove the email address's send history");
    const { error: contactsError } = await db.from("marketing_contacts").delete().eq("email", email);
    if (contactsError) throw new Error("Could not remove the lead's marketing contact record");
    const { error: preferencesError } = await db.from("marketing_preferences").delete().eq("email", email);
    if (preferencesError) throw new Error("Could not remove the lead's email preferences");

    if (candidateUserId) {
      const { error } = await db.auth.admin.deleteUser(candidateUserId);
      if (error) throw new Error(`Documents and email records were removed, but the lead and login account remain because account deletion failed: ${error.message}. You can retry.`);
    }

    const { error: deleteLeadError } = await db.from("consultations").delete().eq("id", consultationId);
    if (deleteLeadError) throw new Error(`The login account was removed, but lead records could not be deleted: ${deleteLeadError.message}`);

    return json({ ok: true });
  } catch (error) {
    console.error("admin-delete-lead failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not delete the lead" }, 500);
  }
});
