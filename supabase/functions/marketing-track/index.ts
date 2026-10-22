import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const pixel = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  if (token && (action === "open" || action === "click")) {
    const { data: contact } = await db.from("marketing_contacts").select("id, email, status, open_count, click_count").eq("tracking_token", token).maybeSingle();
    if (contact && contact.status !== "account_created") {
      const now = new Date().toISOString();
      await db.from("marketing_contacts").update(action === "open" ? { status: contact.status === "clicked" ? "clicked" : "opened", open_count: contact.open_count + 1, last_opened_at: now } : { status: "clicked", click_count: contact.click_count + 1, last_clicked_at: now }).eq("id", contact.id);
    }
    if (action === "click") return Response.redirect(`https://consultation.outreachstudy.eu/?email=${encodeURIComponent(contact?.email ?? "")}&source=email-invite`, 302);
  }
  return new Response(pixel, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
});
