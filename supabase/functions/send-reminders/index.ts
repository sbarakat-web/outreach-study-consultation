// Scheduled every minute (pg_cron → pg_net). Idempotent: each reminder is claimed
// with a timestamp before sending, so extra calls never send twice.
//   24h before a confirmed call  → email
//   1h before                    → email (+ WhatsApp via Twilio when configured)
//   10 min before                → presenters get a one-click sign-in link to the online session
//   documents due in ≤3 days / due now, required files missing → email
//   suggested call time not confirmed after 24h → one "please confirm" email (candidate's language)
// Secrets: RESEND_API_KEY; optional MAIL_FROM, APP_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, highlight, layout, para, title, escape } from "../_shared/email.ts";
import { loadAdvisor, sendEmail as sendCallEmail, suggestEmail } from "../_shared/call.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const MAIL_FROM = () => env("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>";
const H = 3_600_000;

// Must match DOCUMENT_TYPES (required) in src/lib/options.ts
const REQUIRED: Record<string, string[]> = {
  english: ["cv", "passport", "course_certificates", "personal_statement"],
  higher_education: ["cv", "passport", "course_certificates", "personal_statement"],
};
const LABELS: Record<string, string> = {
  cv: "Updated CV in Europass Format",
  passport: "Passport Bio Page",
  course_certificates: "Certificates with transcripts",
  personal_statement: "300-word personal statement",
};

function when(iso: string, tz: string) {
  const f = (zone: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(iso));
  try {
    return tz && tz !== "Europe/Malta" ? `${f(tz)} (your time)` : `${f("Europe/Malta")} (Malta time)`;
  } catch {
    return `${f("Europe/Malta")} (Malta time)`;
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resend allows ~2 requests/second: retry rate-limited and transient failures, and log anything that still fails. */
async function sendEmail(to: string, subject: string, html: string, cc?: string) {
  if (!env("RESEND_API_KEY")) return false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM(), to, subject, html, ...(cc ? { cc } : {}) }),
    });
    if (res.ok) return true;
    const detail = await res.text().catch(() => "");
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await pause(1200 * attempt);
      continue;
    }
    console.error(`send-reminders: email to ${to} failed (${res.status}): ${detail}`);
    return false;
  }
  return false;
}

// Labels as in src/lib/options.ts
const PATHS: Record<string, string> = { english: "English course", higher_education: "Higher education" };
const LEVELS: Record<string, string> = { below_b2: "Below B2", b2_plus: "B2 or above" };
// Copied on every presenter email.
const PRESENTER_CC = () => env("PRESENTER_CC") || "sbarakat@outreachrecruitment.net";

/** 10 minutes before a call: every presenter gets the candidate brief and a one-click link into the session. */
// deno-lint-ignore no-explicit-any
async function presenterEmail(db: any, c: any, presenters: string[]) {
  const malta = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(c.preferred_call_at));
  const sessionPath = `/onlinesessions?candidate=${c.id}`;
  const { data: docs } = await db.from("documents").select("doc_type, review_status").eq("consultation_id", c.id);
  const have = new Set((docs ?? []).filter((d: { review_status: string }) => d.review_status !== "rejected").map((d: { doc_type: string }) => d.doc_type));
  const required = REQUIRED[c.study_path] ?? REQUIRED.english;
  const docsLine = `${required.filter((k) => have.has(k)).length}/${required.length} uploaded`;
  for (const [i, to] of presenters.entries()) {
    if (i > 0) await pause(700); // stay under Resend's rate limit
    // One-time sign-in link straight into this candidate's session; the password link is the fallback.
    const link = await db.auth.admin.generateLink({ type: "magiclink", email: to, options: { redirectTo: `${APP_URL()}${sessionPath}` } });
    const login = `${APP_URL()}/login?next=${encodeURIComponent(sessionPath)}&email=${encodeURIComponent(to)}`;
    const open = link.data?.properties?.action_link ?? login;
    await sendEmail(
      to,
      `Starting in 10 min: online session with ${c.full_name} — ${malta}`,
      layout(
        eyebrow("Starting in 10 minutes") +
          title("Hello, this email is from Soufiane 👋") +
          para(`Your online session with <strong>${escape(c.full_name)}</strong> starts at <strong>${malta} (Malta time)</strong>. The button signs you in and opens the presentation.`, true) +
          actions(button(open, "▶ Open the presentation"), c.meeting_url ? button(c.meeting_url, "Join Google Meet", "#14123a") : "") +
          facts([
            ["Candidate", c.full_name],
            ["Study path", PATHS[c.study_path] ?? c.study_path],
            ["English level", LEVELS[c.english_level] ?? c.english_level],
            ["Course", c.desired_course],
            ["Country", c.country],
            ["WhatsApp", c.whatsapp],
            ["Documents", docsLine],
            ["Message", c.message ? String(c.message).slice(0, 300) : null],
          ]) +
          `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#ecfdf5;color:#065f46;text-align:center;font-size:14px"><strong>After the session:</strong> choose <strong>Interviewed</strong>, <strong>No-show</strong> or <strong>No longer interested</strong> and add a comment if needed, so we can follow up in the platform.</p>` +
          para("The button works once and for 1 hour. If it has expired, sign in with:", true) +
          // Presenter accounts use their email address as the password (owner's choice).
          highlight(`Email: <strong>${escape(to)}</strong><br>Password: <strong>${escape(to)}</strong>`) +
          actions(button(login, "Sign in with password", "#14123a")),
        `${c.full_name} at ${malta} — open the presentation`,
        "en",
        { url: "https://outreachrecruitment.net", label: "outreachrecruitment.net", brand: "Outreach Recruitment — Study in Malta" },
      ),
      presenters.includes(PRESENTER_CC()) ? undefined : PRESENTER_CC(),
    );
  }
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
  const sent = { h24: 0, h1: 0, docs: 0, confirm: 0, presenter: 0 };

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
  const { data: presenterRows } = await db.from("session_presenters").select("email");
  const presenters = (presenterRows ?? []).map((p: { email: string }) => p.email);
  for (const c of calls ?? []) {
    if (["interviewed", "no_longer_interested"].includes(c.session_outcome ?? "")) continue;
    const ms = new Date(c.preferred_call_at).getTime() - now;
    if (presenters.length && ms <= 10 * 60_000 && !c.presenter_alert_at && (await claim(c.id, "presenter_alert_at"))) {
      await presenterEmail(db, c, presenters);
      sent.presenter++;
    }
    const tz = c.tracking?.tz ?? "Europe/Malta";
    const first = c.full_name.split(" ")[0];
    const t = when(c.preferred_call_at, tz);

    if (ms <= 75 * 60_000 && !c.reminder_1h_at && (await claim(c.id, "reminder_1h_at"))) {
      await sendEmail(
        c.email,
        `Starting soon: your Outreach call at ${t}`,
        layout(
          eyebrow("Starting soon") +
            title(`Hi ${escape(first)}, your call starts in about an hour`) +
            highlight(`<strong style="font-size:18px">${escape(t)}</strong>`) +
            (c.meeting_url ? actions(button(c.meeting_url, "Join the call")) : para("Your advisor will send you the Google Meet link before the call.", true)),
          `Your call starts at ${t}`,
        ),
      );
      if (c.whatsapp) await sendWhatsApp(c.whatsapp, `Hi ${first}, your Outreach call starts in about 1 hour (${t}).${c.meeting_url ? ` Join: ${c.meeting_url}` : ""}`);
      sent.h1++;
    } else if (ms > 75 * 60_000 && ms <= 25 * H && !c.reminder_24h_at && (await claim(c.id, "reminder_24h_at"))) {
      await sendEmail(
        c.email,
        `Reminder: your free call tomorrow — ${t}`,
        layout(
          eyebrow("Reminder") +
            title(`Hi ${escape(first)}, see you tomorrow!`) +
            highlight(`<strong style="font-size:18px">${escape(t)}</strong>`) +
            para("Please upload your passport and latest certificate before the call.", true) +
            actions(c.meeting_url ? button(c.meeting_url, "Join link") : "", button(`${APP_URL()}/dashboard/documents`, "Upload documents")),
          `Your call tomorrow: ${t}`,
        ),
      );
      sent.h24++;
    }
  }

  // Suggested time still not confirmed after 24h → one reminder with the same link
  const { data: waiting } = await db
    .from("consultations")
    .select("*")
    .neq("call_status", "confirmed")
    .is("call_declined_at", null)
    .is("suggest_reminder_at", null)
    .not("call_confirm_token", "is", null)
    .lt("call_suggested_at", iso(now - 24 * H))
    .gt("suggested_call_at", iso(now + 3 * H));
  for (const c of waiting ?? []) {
    if (!(await claim(c.id, "suggest_reminder_at"))) continue;
    const mail = suggestEmail(c, {
      at: c.suggested_call_at,
      token: c.call_confirm_token,
      advisor: await loadAdvisor(db, c.call_suggested_by),
      confirmBy: c.call_confirm_by && new Date(c.call_confirm_by).getTime() > now ? c.call_confirm_by : null,
      reminder: true,
    });
    await sendCallEmail({ to: c.email, subject: mail.subject, html: mail.html });
    sent.confirm++;
  }

  // Document deadline reminders (after an interviewed session)
  const { data: due } = await db
    .from("consultations")
    .select("*")
    .eq("session_outcome", "interviewed")
    .not("documents_due_at", "is", null)
    .lt("documents_due_at", iso(now + 3 * 24 * H))
    .neq("status", "not_interested");
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
      layout(
        eyebrow(isFinal ? "Due today" : "Documents reminder") +
          title(`Hi ${escape(c.full_name.split(" ")[0])}, a few documents are missing`) +
          para(isFinal ? "Your documents are due today. Still missing:" : `Please upload your documents by <strong>${dueText}</strong>. Still missing:`, true) +
          highlight(missing.map((k) => `<strong>${LABELS[k] ?? k}</strong>`).join("<br>")) +
          actions(button(`${APP_URL()}/dashboard/documents`, "Upload documents")),
        "Your documents are almost due",
      ),
    );
    sent.docs++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
