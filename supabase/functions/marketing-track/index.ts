// Public tracking endpoint for marketing emails.
//   ?s=<send token>&action=open|click&u=<url>     campaign sends (opens, clicks → redirect)
//   ?token=<contact token>&action=open|click      account-invitation journey
//   ?p=<preferences token>[&s=…]&action=unsubscribe   (also the legacy ?token=…&action=unsubscribe)
// Unsubscribe: opening the link only asks to confirm (email scanners open links); the button or the
// mail client's one-click unsubscribe (List-Unsubscribe-Post) sends a POST that does it.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const pixel = Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);
const APP = "https://consultation.outreachstudy.eu";
const UUID = /^[0-9a-f-]{36}$/i;

const page = (done: boolean, prefsUrl?: string) =>
  new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${done ? "Unsubscribed" : "Unsubscribe"} · Outreach Study</title><body style="margin:0;background:#f4f5fb;font-family:Arial,sans-serif;color:#14123a"><main style="max-width:520px;margin:60px auto;padding:20px"><section style="background:#fff;border-radius:24px;padding:40px;text-align:center;box-shadow:0 20px 70px rgba(20,18,58,.12);border-top:6px solid #442DFA"><img src="${APP}/logo.png" alt="Outreach Study" width="200" style="max-width:70%;height:auto">${
      done
        ? `<h1 style="margin:28px 0 12px">You’re unsubscribed</h1><p style="color:#5b6080;line-height:1.6">You will no longer receive marketing emails from Outreach Study. Essential messages about an existing consultation or account may still be sent.</p><a href="https://outreachstudy.eu" style="display:inline-block;margin-top:18px;color:#442DFA;font-weight:bold">Return to Outreach Study</a>`
        : `<h1 style="margin:28px 0 12px">Unsubscribe from Outreach emails?</h1><p style="color:#5b6080;line-height:1.6">You will stop receiving news, deadlines and invitations from Outreach Study.</p><form method="post"><button type="submit" style="margin-top:18px;background:#442DFA;color:#fff;border:0;border-radius:999px;padding:14px 28px;font-weight:bold;font-size:15px;cursor:pointer">Confirm unsubscribe</button></form>${
            prefsUrl ? `<p style="margin-top:18px"><a href="${prefsUrl}" style="color:#442DFA">Or choose which emails you get</a></p>` : ""
          }`
    }</section></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const token = url.searchParams.get("token");
  const s = url.searchParams.get("s");
  const p = url.searchParams.get("p");
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const now = new Date().toISOString();

  if (action === "unsubscribe") {
    if (req.method === "POST") {
      let email: string | null = null;
      if (p && UUID.test(p)) {
        const { data } = await db.from("marketing_preferences").update({ unsubscribed_at: now, updated_at: now }).eq("token", p).select("email").maybeSingle();
        email = data?.email ?? null;
      }
      if (token && UUID.test(token)) {
        const { data } = await db.from("marketing_contacts").select("email").eq("tracking_token", token).maybeSingle();
        email = data?.email ?? email;
        if (email) await db.from("marketing_preferences").upsert({ email, unsubscribed_at: now, updated_at: now }, { onConflict: "email" });
      }
      if (s && UUID.test(s)) await db.from("marketing_sends").update({ unsubscribed_at: now }).eq("token", s).is("unsubscribed_at", null);
      if (email) await db.from("marketing_contacts").update({ status: "unsubscribed", unsubscribed_at: now, next_follow_up_at: null }).eq("email", email).neq("status", "account_created");
      return page(true);
    }
    return page(false, p && UUID.test(p) ? `${APP}/email-preferences?t=${p}` : undefined);
  }

  // Campaign sends
  if (s && UUID.test(s) && (action === "open" || action === "click")) {
    const { data: send } = await db.from("marketing_sends").select("id, open_count, click_count, opened_at, clicked_at").eq("token", s).maybeSingle();
    if (send) {
      await db
        .from("marketing_sends")
        .update(
          action === "open"
            ? { open_count: send.open_count + 1, opened_at: send.opened_at ?? now }
            : { click_count: send.click_count + 1, clicked_at: send.clicked_at ?? now, opened_at: send.opened_at ?? now },
        )
        .eq("id", send.id);
    }
    if (action === "click") {
      const target = url.searchParams.get("u") ?? "";
      return Response.redirect(send && /^https?:\/\//i.test(target) ? target : APP, 302);
    }
    return new Response(pixel, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
  }

  // Account-invitation journey
  if (token && (action === "open" || action === "click")) {
    const { data: contact } = await db.from("marketing_contacts").select("id, email, status, open_count, click_count").eq("tracking_token", token).maybeSingle();
    if (contact && !["account_created", "unsubscribed"].includes(contact.status)) {
      await db
        .from("marketing_contacts")
        .update(
          action === "open"
            ? { status: contact.status === "clicked" ? "clicked" : "opened", open_count: contact.open_count + 1, last_opened_at: now }
            : { status: "clicked", click_count: contact.click_count + 1, last_clicked_at: now },
        )
        .eq("id", contact.id);
    }
    if (action === "click") return Response.redirect(`${APP}/?email=${encodeURIComponent(contact?.email ?? "")}&source=email-invite`, 302);
  }
  return new Response(pixel, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
});
