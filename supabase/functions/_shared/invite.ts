// Account invitations: one send (admin button) and the CSV queue (one email per batch per run,
// spaced by the interval the admin chose).
import { loadSettings, prefsToken, renderFor, sendMail } from "./marketing-send.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const env = (k: string) => Deno.env.get(k) ?? "";

/** Render the "Account invite" template for one contact, send it and record the result. */
export async function sendInvite(db: Db, contact: Row) {
  const { data: template } = await db.from("marketing_email_templates").select("*").eq("id", "account-invite").maybeSingle();
  const functionsUrl = `${env("SUPABASE_URL")}/functions/v1`;
  const clickUrl = `${functionsUrl}/marketing-track?token=${contact.tracking_token}&action=click`;
  const openUrl = `${functionsUrl}/marketing-track?token=${contact.tracking_token}&action=open`;
  const firstName = String(contact.full_name).split(/\s+/)[0];
  // {signup_link} in the template's button goes through click tracking to the sign-up form.
  const mail = renderFor(
    template ?? { blocks: [{ id: "t", type: "text", text: "Create your free Outreach Study account." }, { id: "b", type: "button", label: "Create my free account", href: "{signup_link}" }] },
    template?.subject || "{name}, create your free Outreach Study account",
    await loadSettings(db),
    { name: firstName, signup_link: clickUrl },
    await prefsToken(db, contact.email),
    undefined,
    openUrl,
  );
  const result = await sendMail(contact.email, mail.subject, mail.html, mail.text, mail.unsubscribe);
  const sentAt = new Date();
  await db
    .from("marketing_contacts")
    .update(
      result.ok
        ? { status: "sent", send_count: (contact.send_count || 0) + 1, last_sent_at: sentAt.toISOString(), scheduled_at: null, next_follow_up_at: new Date(sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString(), provider_email_id: result.id ?? null, last_error: null }
        : { status: "failed", scheduled_at: null, next_follow_up_at: null, last_error: result.error ?? "Email could not be sent" },
    )
    .eq("id", contact.id);
  return result;
}

/** Send due queued invitations: at most one per batch per run, so emails keep their spacing. */
export async function processInviteQueue(db: Db) {
  const { data: due } = await db.from("marketing_contacts").select("id, batch_id").eq("status", "queued").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(200);
  const seen = new Set<string>();
  let sent = 0;
  for (const row of due ?? []) {
    const batch = row.batch_id ?? row.id;
    if (seen.has(batch)) continue;
    seen.add(batch);
    const { data: contact } = await db.from("marketing_contacts").update({ status: "sending" }).eq("id", row.id).eq("status", "queued").select("*").maybeSingle();
    if (!contact) continue;
    const { data: pref } = await db.from("marketing_preferences").select("unsubscribed_at").eq("email", contact.email).maybeSingle();
    if (pref?.unsubscribed_at) {
      await db.from("marketing_contacts").update({ status: "unsubscribed", scheduled_at: null }).eq("id", contact.id);
      continue;
    }
    if ((await sendInvite(db, contact)).ok) sent++;
  }
  return sent;
}
