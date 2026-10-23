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

    const associatedLeads: { id: string; user_id: string | null }[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await db
        .from("consultations")
        .select("id, user_id")
        .eq("email", email)
        .range(start, start + 999);
      if (error) throw new Error("Could not load all leads associated with this email");
      associatedLeads.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const consultationIds = associatedLeads.map((item) => item.id);
    const userIds = new Set(associatedLeads.flatMap((item) => (item.user_id ? [item.user_id] : [])));

    let candidateUserId: string | null = null;
    for (let page = 1; !candidateUserId; page += 1) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not check for a login account linked to this lead");
      const matchingUser = data.users.find((user) => user.email?.toLowerCase() === email);
      candidateUserId = matchingUser?.id ?? null;
      if (candidateUserId || data.users.length < 1000) break;
    }
    if (candidateUserId) userIds.add(candidateUserId);

    for (const userId of userIds) {
      const { data, error } = await db.auth.admin.getUserById(userId);
      if (error) throw new Error("Could not verify a login account linked to this lead");
      if (data.user.email?.toLowerCase() !== email) {
        return json({ error: "A linked login email does not match; no data was deleted" }, 409);
      }
    }

    const documents: { file_path: string; user_id: string }[] = [];
    for (let start = 0; start < consultationIds.length; start += 500) {
      const ids = consultationIds.slice(start, start + 500);
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db
          .from("documents")
          .select("file_path, user_id")
          .in("consultation_id", ids)
          .range(offset, offset + 999);
        if (error) throw new Error("Could not load all uploaded documents for this email");
        documents.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
    }

    const filePaths = new Set(documents.map((document) => document.file_path));
    const ownerIds = new Set([...userIds, ...documents.map((document) => document.user_id)]);
    for (const ownerId of ownerIds) {
      for (const id of consultationIds) {
        let offset = 0;
        while (true) {
          const { data: files, error } = await db.storage
            .from("documents")
            .list(`${ownerId}/${id}`, { limit: 1000, offset });
          if (error) throw new Error(`Could not list uploaded documents: ${error.message}`);
          for (const file of files ?? []) {
            if (file.id) filePaths.add(`${ownerId}/${id}/${file.name}`);
          }
          if (!files || files.length < 1000) break;
          offset += 1000;
        }
      }
    }

    const paths = [...filePaths];
    for (let start = 0; start < paths.length; start += 1000) {
      const { error } = await db.storage.from("documents").remove(paths.slice(start, start + 1000));
      if (error) throw new Error(`Could not remove uploaded documents: ${error.message}`);
    }

    const { error: sendsByEmailError } = await db.from("marketing_sends").delete().eq("email", email);
    if (sendsByEmailError) throw new Error("Could not remove the email address's send history");
    const { error: contactsError } = await db.from("marketing_contacts").delete().eq("email", email);
    if (contactsError) throw new Error("Could not remove the lead's marketing contact record");
    const { error: preferencesError } = await db.from("marketing_preferences").delete().eq("email", email);
    if (preferencesError) throw new Error("Could not remove the lead's email preferences");

    for (const userId of userIds) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(`Documents and email records were removed, but the leads and login account remain because account deletion failed: ${error.message}. You can retry.`);
    }

    const otherConsultationIds = consultationIds.filter((id) => id !== consultationId);
    for (let start = 0; start < otherConsultationIds.length; start += 500) {
      const { error: deleteLeadError } = await db.from("consultations").delete().in("id", otherConsultationIds.slice(start, start + 500));
      if (deleteLeadError) throw new Error(`The login account was removed, but some related lead records could not be deleted: ${deleteLeadError.message}. Retry using the remaining lead.`);
    }
    const { error: deleteLeadError } = await db.from("consultations").delete().eq("id", consultationId);
    if (deleteLeadError) throw new Error(`Related lead records were removed, but this lead could not be deleted: ${deleteLeadError.message}. Retry the deletion.`);

    return json({ ok: true });
  } catch (error) {
    console.error("admin-delete-lead failed", error);
    return json({ error: error instanceof Error ? error.message : "Could not delete the lead" }, 500);
  }
});
