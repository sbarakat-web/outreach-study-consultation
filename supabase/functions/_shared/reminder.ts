// "Book your free call" reminders (new leads) and "choose a new time" reminders (cancelled appointments).
// The team can edit the wording in admin (Preview & edit email); the saved text lives in marketing_email_templates
// under REMINDER_TEMPLATE_IDS and falls back to REMINDER_DEFAULTS. Must match src/lib/reminderTemplate.ts.
import { actions, button, eyebrow, layout, para, title, escape } from "./email.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

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

/** The saved wording for this reminder, or the default. */
export async function loadReminderText(db: Db, kind: ReminderKind): Promise<ReminderText> {
  const { data } = await db.from("marketing_email_templates").select("body").eq("id", REMINDER_TEMPLATE_IDS[kind]).maybeSingle();
  try {
    return { ...REMINDER_DEFAULTS[kind], ...(data?.body ? JSON.parse(data.body) : {}) };
  } catch {
    return REMINDER_DEFAULTS[kind];
  }
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? vars[k] : whole));
/** Escaped text with **bold** and line breaks. */
const rich = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");

export function renderReminder(kind: ReminderKind, t: ReminderText, vars: { name: string; course: string; date: string; link: string }) {
  const v = { ...vars };
  const points = t.points
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const html = layout(
    eyebrow(kind === "rebook" ? "Book a new time" : "Free consultation") +
      title(rich(fill(t.heading, v))) +
      para(rich(fill(t.intro, v)), true) +
      actions(button(v.link, fill(t.button, v))) +
      (points.length
        ? `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 8px;color:#14123a;font-weight:bold">In 20 minutes on Google Meet, we'll:</p>
          ${points.map((p) => `<p style="margin:0 0 6px;color:#5b6080;font-size:14px">✓ ${rich(fill(p, v))}</p>`).join("")}
        </div>`
        : "") +
      (t.note.trim() ? para(rich(fill(t.note, v)), true) : "") +
      para(`Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp +356 9972 8213</a>`, true),
    fill(t.subject, v),
    "en",
    { url: "https://outreachstudy.eu", label: "outreachstudy.eu", brand: "Outreach Recruitment — Study in Malta" },
  );
  return { subject: fill(t.subject, v), html, wa: fill(t.whatsapp, v) };
}
