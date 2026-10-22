// Scheduled every 15 minutes (pg_cron → pg_net). Idempotent: each reminder is claimed
// with a timestamp before sending, so extra calls never send twice.
//   24h before a confirmed call  → email
//   1h before                    → email (+ WhatsApp via Twilio when configured)
//   documents due in ≤3 days / due now, required files missing → email
// Secrets: RESEND_API_KEY; optional MAIL_FROM, APP_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const MAIL_FROM = () => env("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>";
const H = 3_600_000;

// Must match DOCUMENT_TYPES (required) in src/lib/options.ts
const REQUIRED: Record<string, string[]> = {
  english: ["passport"],
  higher_education: ["passport", "diploma", "transcripts"],
};
const LABELS: Record<string, string> = { passport: "Passport", diploma: "Highest diploma", transcripts: "Transcripts" };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const layout = (inner: string) => `<div style="font-family:Arial,sans-serif;color:#14123a;line-height:1.6;max-width:560px">
  <div style="height:6px;background:#442DFA;border-radius:6px 6px 0 0"></div>
  <img src="${APP_URL()}/logo.png" alt="Outreach — Study in Malta" width="180" style="display:block;margin:20px 0">${inner}</div>`;
const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#442DFA;color:#fff;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:bold;margin:4px 6px 4px 0">${label}</a>`;

function when(iso: string, tz: string) {
  const f = (zone: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(iso));
  try {
    return tz && tz !== "Europe/Malta" ? `${f(tz)} (your time)` : `${f("Europe/Malta")} (Malta time)`;
  } catch {
    return `${f("Europe/Malta")} (Malta time)`;
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!env("RESEND_API_KEY")) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM(), to, subject, html }),
  });
  return res.ok;
}

async function sendWhatsApp(to: string, text: string) {
  const sid = env("TWILIO_ACCOUNT_SID");
  if (!sid || !env("TWILIO_AUTH_TOKEN") || !env("TWILIO_WHATSAPP_FROM")) return;
  const digits = to.replace(/[^\d+]/g, "");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: `whatsapp:${env("TWILIO_WHATSAPP_FROM")}`, To: `whatsapp:${digits.startsWith("+") ? digits : "+" + digits}`, Body: text }),
  });
}

Deno.serve(async () => {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const sent = { h24: 0, h1: 0, docs: 0 };

  // Claim a reminder column atomically; returns the row only if this call won it.
  const claim = async (id: string, column: string) => {
    const { data } = await db.from("consultations").update({ [column]: new Date().toISOString() }).eq("id", id).is(column, null).select("id").maybeSingle();
    return !!data;
  };

  // Call reminders
  const { data: calls } = await db
    .from("consultations")
    .select("*")
    .eq("call_status", "confirmed")
    .is("call_declined_at", null)
    .gt("preferred_call_at", iso(now))
    .lt("preferred_call_at", iso(now + 25 * H));
  for (const c of calls ?? []) {
    if (["interviewed", "no_longer_interested"].includes(c.session_outcome ?? "")) continue;
    const ms = new Date(c.preferred_call_at).getTime() - now;
    const tz = c.tracking?.tz ?? "Europe/Malta";
    const first = c.full_name.split(" ")[0];
    const t = when(c.preferred_call_at, tz);

    if (ms <= 75 * 60_000 && !c.reminder_1h_at && (await claim(c.id, "reminder_1h_at"))) {
      await sendEmail(
        c.email,
        `Starting soon: your Outreach call at ${t}`,
        layout(`<h2 style="margin:0 0 8px">Hi ${escape(first)}, your call starts in about an hour</h2>
          <p style="font-size:16px"><strong>${escape(t)}</strong></p>
          <p>${c.meeting_url ? button(c.meeting_url, "Join the call") : "Your advisor will call you on WhatsApp."}</p>`),
      );
      if (c.whatsapp) await sendWhatsApp(c.whatsapp, `Hi ${first}, your Outreach call starts in about 1 hour (${t}).${c.meeting_url ? ` Join: ${c.meeting_url}` : ""}`);
      sent.h1++;
    } else if (ms > 75 * 60_000 && ms <= 25 * H && !c.reminder_24h_at && (await claim(c.id, "reminder_24h_at"))) {
      await sendEmail(
        c.email,
        `Reminder: your free call tomorrow — ${t}`,
        layout(`<h2 style="margin:0 0 8px">Hi ${escape(first)}, see you tomorrow!</h2>
          <p style="font-size:16px"><strong>${escape(t)}</strong></p>
          <p>Please upload your passport and latest certificate before the call.</p>
          <p>${c.meeting_url ? button(c.meeting_url, "Join link") : ""}${button(`${APP_URL()}/dashboard/documents`, "Upload documents")}</p>`),
      );
      sent.h24++;
    }
  }

  // Document deadline reminders (after an interviewed session)
  const { data: due } = await db
    .from("consultations")
    .select("*")
    .eq("session_outcome", "interviewed")
    .not("documents_due_at", "is", null)
    .lt("documents_due_at", iso(now + 3 * 24 * H))
    .neq("status", "lost");
  for (const c of due ?? []) {
    const { data: docs } = await db.from("documents").select("doc_type, review_status").eq("consultation_id", c.id);
    const have = new Set((docs ?? []).filter((d) => d.review_status !== "rejected").map((d) => d.doc_type));
    const missing = (REQUIRED[c.study_path] ?? REQUIRED.english).filter((k) => !have.has(k));
    if (!missing.length) continue;
    const isFinal = new Date(c.documents_due_at).getTime() - now <= 12 * H;
    const column = isFinal ? "docs_reminder_final_at" : "docs_reminder_at";
    if (c[column] || !(await claim(c.id, column))) continue;
    const dueText = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(c.documents_due_at));
    await sendEmail(
      c.email,
      isFinal ? `${c.full_name.split(" ")[0]}, your documents are due today` : `Reminder: please upload your documents by ${dueText}`,
      layout(`<h2 style="margin:0 0 8px">Hi ${escape(c.full_name.split(" ")[0])},</h2>
        <p>${isFinal ? "Your documents are due today." : `Please upload your documents by <strong>${dueText}</strong>.`} Still missing:</p>
        <ul>${missing.map((k) => `<li>${LABELS[k] ?? k}</li>`).join("")}</ul>
        <p>${button(`${APP_URL()}/dashboard/documents`, "Upload documents")}</p>`),
    );
    sent.docs++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
