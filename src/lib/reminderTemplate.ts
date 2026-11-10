// Editable wording of the booking reminders (Preview & edit email in admin).
// Defaults and rendering must match supabase/functions/_shared/reminder.ts, which sends the real email.
import { supabase } from "./supabase";

export type ReminderKind = "book" | "rebook";

export interface ReminderText {
  subject: string;
  heading: string;
  intro: string;
  button: string;
  points: string;
  note: string;
  whatsapp: string;
}

export const REMINDER_TEMPLATE_IDS: Record<ReminderKind, string> = { book: "reminder-book", rebook: "reminder-rebook" };

const WHATSAPP_INTRO = "Hi {name} 👋 this is Soufiane from Outreach — Study in Malta.";
const POINTS = "Find the best programme in Malta for your profile\nExplain costs, scholarships and payment options\nGuide you through the student visa steps";

export const REMINDER_DEFAULTS: Record<ReminderKind, ReminderText> = {
  book: {
    subject: "{name}, your free consultation is waiting — book your time",
    heading: "Hi {name}, let's talk about your plans!",
    intro: "Thank you for applying for **{course}**. You haven't booked your free consultation yet — choose a time that suits you, it takes less than a minute.",
    button: "📅 Book my free call",
    points: POINTS,
    note: "Only free times are shown, in your own time zone. Free, no commitment.",
    whatsapp: `${WHATSAPP_INTRO}\n\nThank you for applying for {course}! 🎓 You haven't booked your free consultation yet.\n\n📅 Choose a time that suits you here (takes less than a minute): {link}\n\nIn 20 minutes we'll find the best programme for you and explain costs, scholarships and the visa steps. Free, no commitment 😊`,
  },
  rebook: {
    subject: "{name}, let's find a new time for your free consultation",
    heading: "Hi {name}, we'd still love to talk!",
    intro: "Your appointment on **{date}** was cancelled, and you haven't chosen a new time yet. Pick the time that suits you best — it takes less than a minute.",
    button: "📅 Choose a new time",
    points: POINTS,
    note: "Only free times are shown, in your own time zone. Free, no commitment.",
    whatsapp: `${WHATSAPP_INTRO}\n\nYour appointment on {date} was cancelled, and we'd still love to talk with you about {course}! 🎓\n\n📅 Choose a new time that suits you here (takes less than a minute): {link}\n\nIn 20 minutes we'll find the best programme for you and explain costs, scholarships and the visa steps. Free, no commitment 😊`,
  },
};

export async function loadReminderText(kind: ReminderKind): Promise<{ text: ReminderText; saved: boolean }> {
  const { data } = await supabase.from("marketing_email_templates").select("body").eq("id", REMINDER_TEMPLATE_IDS[kind]).maybeSingle();
  try {
    return data?.body ? { text: { ...REMINDER_DEFAULTS[kind], ...JSON.parse(data.body) }, saved: true } : { text: REMINDER_DEFAULTS[kind], saved: false };
  } catch {
    return { text: REMINDER_DEFAULTS[kind], saved: false };
  }
}

export async function saveReminderText(kind: ReminderKind, text: ReminderText) {
  const { data: auth } = await supabase.auth.getUser();
  return supabase.from("marketing_email_templates").upsert({
    id: REMINDER_TEMPLATE_IDS[kind],
    name: kind === "rebook" ? "Reminder: choose a new time (cancelled)" : "Reminder: book your free call (new lead)",
    subject: text.subject,
    body: JSON.stringify(text),
    preheader: "",
    blocks: [],
    topic: "news",
    is_system: true,
    updated_by: auth.user?.id ?? null,
    updated_at: new Date().toISOString(),
  });
}

export const resetReminderText = (kind: ReminderKind) => supabase.from("marketing_email_templates").delete().eq("id", REMINDER_TEMPLATE_IDS[kind]);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const fillReminder = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? vars[k] : whole));
const rich = (text: string) => esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");

/** The email as the candidate will see it (same layout as the sent one). */
export function previewReminderHtml(kind: ReminderKind, t: ReminderText, vars: Record<string, string>) {
  const f = (s: string) => rich(fillReminder(s, vars));
  const points = t.points.split("\n").map((p) => p.trim()).filter(Boolean);
  const p = (html: string) => `<p style="margin:0 0 14px;color:#5b6080;text-align:center">${html}</p>`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5fb">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="height:6px;background:#442DFA;font-size:0">&nbsp;</td></tr>
<tr><td align="center" style="padding:30px 28px 6px"><img src="${window.location.origin}/logo.png" alt="Outreach" width="200" style="display:block;width:200px;max-width:70%;height:auto"></td></tr>
<tr><td style="padding:18px 28px 30px;color:#14123a;font-size:15px;line-height:1.65">
<p style="margin:0 0 6px;text-align:center;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#442DFA">${kind === "rebook" ? "Book a new time" : "Free consultation"}</p>
<h1 style="margin:0 0 14px;text-align:center;font-size:24px;line-height:1.3">${f(t.heading)}</h1>
${p(f(t.intro))}
<p style="margin:22px 0;text-align:center"><a href="#" style="display:inline-block;background:#442DFA;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px">${esc(fillReminder(t.button, vars))}</a></p>
${points.length ? `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px"><p style="margin:0 0 8px;font-weight:bold">In 20 minutes on Google Meet, we'll:</p>${points.map((x) => `<p style="margin:0 0 6px;color:#5b6080;font-size:14px">✓ ${f(x)}</p>`).join("")}</div>` : ""}
${t.note.trim() ? p(f(t.note)) : ""}
${p('Questions? <a href="#" style="color:#442DFA;font-weight:bold">WhatsApp +356 9972 8213</a>')}
</td></tr>
<tr><td align="center" style="padding:20px 28px;background:#f8f8fc;color:#8a8ea8;font-size:12px"><strong style="color:#14123a">Outreach Recruitment — Study in Malta</strong><br>outreachstudy.eu · WhatsApp +356 9972 8213</td></tr>
</table></td></tr></table></body></html>`;
}
