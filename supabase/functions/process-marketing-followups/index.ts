// Scheduled every minute by pg_cron: queued CSV invitations, 24h invitation follow-ups and due
// campaign emails (scheduled / local-morning sends). Every row is claimed before sending, so
// overlapping runs never double-send.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, escape, eyebrow, highlight, layout, para, title } from "../_shared/email.ts";
import { processDueSends } from "../_shared/marketing-send.ts";
import { processInviteQueue } from "../_shared/invite.ts";

const env = (key: string) => Deno.env.get(key) ?? "";

async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("MAIL_FROM") || "Outreach Study <hello@consultation.outreachstudy.eu>", to, reply_to: "study@outreachrecruitment.net", subject, html, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, id: result.id ?? null, error: result.message ?? `Email provider returned ${response.status}` };
}

Deno.serve(async () => {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const now = new Date().toISOString();
  const { data: due, error } = await db.from("marketing_contacts").select("id, full_name, email, status, tracking_token").in("status", ["sent", "opened"]).eq("follow_up_count", 0).lte("next_follow_up_at", now).limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  let sent = 0;
  for (const contact of due ?? []) {
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await db.from("marketing_contacts").update({ follow_up_count: 1, last_follow_up_at: claimedAt, next_follow_up_at: null }).eq("id", contact.id).eq("follow_up_count", 0).in("status", ["sent", "opened"]).select("id, status").maybeSingle();
    if (!claimed) continue;

    const firstName = contact.full_name.split(/\s+/)[0];
    const clickUrl = `${env("SUPABASE_URL")}/functions/v1/marketing-track?token=${contact.tracking_token}&action=click`;
    const openUrl = `${env("SUPABASE_URL")}/functions/v1/marketing-track?token=${contact.tracking_token}&action=open`;
    const unsubscribeUrl = `${env("SUPABASE_URL")}/functions/v1/marketing-track?token=${contact.tracking_token}&action=unsubscribe`;
    const opened = claimed.status === "opened";
    const subject = opened ? `${firstName}, finish creating your Outreach Study account` : `${firstName}, your Malta study account is waiting`;
    const html = layout(
      eyebrow(opened ? "You're almost there" : "A quick reminder") +
        title(opened ? `Hi ${escape(firstName)}, ready for the next step?` : `Hi ${escape(firstName)}, did you see your invitation?`) +
        para(opened ? "You opened your invitation but have not created your account yet. Continue now to keep your consultation, documents and next steps together." : "We sent you an invitation yesterday. Create your free account to start your personalised Malta study journey.", true) +
        highlight(opened ? "<strong>It only takes about two minutes to finish.</strong>" : "<strong>Free consultation · Personalised guidance · Secure documents</strong>") +
        actions(button(clickUrl, opened ? "Finish creating my account" : "Create my free account")) +
        para("Already created an account? No action is needed—marketing emails stop automatically.", true) +
        `<p style="margin:22px 0 0;text-align:center;font-size:12px;color:#8a8ea8">No longer interested? <a href="${unsubscribeUrl}" style="color:#5b6080;text-decoration:underline">Unsubscribe</a></p>` +
        `<img src="${openUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`,
      opened ? "Finish setting up your Outreach Study account." : "Your Malta study invitation is waiting.",
    );
    const result = await sendEmail(contact.email, subject, html, unsubscribeUrl);
    if (result.ok) {
      sent++;
      await db.from("marketing_contacts").update({ provider_email_id: result.id, last_error: null }).eq("id", contact.id);
    } else {
      await db.from("marketing_contacts").update({ last_error: result.error }).eq("id", contact.id);
    }
  }
  const invitesSent = await processInviteQueue(db);
  const campaignSent = await processDueSends(db, 300);
  return new Response(JSON.stringify({ ok: true, eligible: due?.length ?? 0, sent, invitesSent, campaignSent }), { headers: { "Content-Type": "application/json" } });
});
