// Call emails shared by notify (staff actions), confirm-call (candidate one-click confirm) and
// send-reminders (24h "please confirm"). Candidate emails follow the candidate's app language.
import { actions, advisorCard, button, eyebrow, highlight, layout, para, steps, title, escape } from "./email.ts";
import { LOCALES, langOf, mailT, type MailLang } from "./mail-i18n.ts";

export const CALL_MINUTES = 20;
export const APP_URL = () => Deno.env.get("APP_URL") || "https://consultation.outreachstudy.eu";
export const MAIL_FROM = () => Deno.env.get("MAIL_FROM") || "Outreach <hello@consultation.outreachstudy.eu>";
export const BOOKING_LINK = () => Deno.env.get("BOOKING_LINK") || "https://calendar.app.google/qTS8FRBH5BZdGgCx7";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
export interface Advisor {
  name: string;
  photo: string | null;
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const H = 3_600_000;

export const tzOf = (c: Row) => c.tracking?.tz ?? "Europe/Malta";
export const firstName = (c: Row) => String(c.full_name).split(" ")[0];

function fmt(iso: string, zone: string, lang: MailLang, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(LOCALES[lang], { ...opts, timeZone: zone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat(LOCALES[lang], { ...opts, timeZone: "Europe/Malta" }).format(new Date(iso));
  }
}
const FULL: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
const SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

/** The time in the candidate's zone, with Malta time underneath when they differ. */
export function whenIn(iso: string, tz: string, lang: MailLang = "en") {
  const t = mailT(lang);
  return tz && tz !== "Europe/Malta"
    ? { main: `${fmt(iso, tz, lang, FULL)} (${t("yourTime")})`, sub: `${fmt(iso, "Europe/Malta", lang, FULL)} ${t("maltaTime")}`, short: fmt(iso, tz, lang, SHORT) }
    : { main: fmt(iso, "Europe/Malta", lang, FULL), sub: t("maltaTime"), short: fmt(iso, "Europe/Malta", lang, SHORT) };
}

/** Soft deadline shown in the email: 48h from now, but at least 6h before the call; none when too close. */
export function confirmByFor(at: string) {
  const by = Math.min(Date.now() + 48 * H, new Date(at).getTime() - 6 * H);
  if (by < Date.now() + 3 * H) return null;
  return new Date(Math.floor(by / H) * H).toISOString();
}

// deno-lint-ignore no-explicit-any
export async function loadAdvisor(db: any, email: string | null | undefined): Promise<Advisor | null> {
  if (!email) return null;
  const { data } = await db.from("staff_profiles").select("display_name, photo_url").eq("email", email).maybeSingle();
  return data?.display_name ? { name: data.display_name, photo: data.photo_url ?? null } : null;
}

/**
 * "Please confirm your call". Two versions, picked from the data:
 *   kept   the admin kept the time the candidate chose → "Good news, your time is available"
 *   moved  the admin changed it → "Can we move your call?" with old → new time
 */
export function suggestEmail(c: Row, o: { at: string; token: string; advisor: Advisor | null; confirmBy: string | null; reminder?: boolean }) {
  const lang = langOf(c);
  const t = mailT(lang);
  const tz = tzOf(c);
  const first = firstName(c);
  const when = whenIn(o.at, tz, lang);
  const asked = c.requested_call_times?.[0] as string | undefined;
  const moved = !!asked && Math.abs(new Date(asked).getTime() - new Date(o.at).getTime()) > 60_000;
  const old = asked ? whenIn(asked, tz, lang) : null;
  const url = `${APP_URL()}/confirm-call?t=${o.token}`;
  // "Choose another time" opens our own picker (free Google Calendar slots, confirmed instantly).
  const pickUrl = `${url}&pick=1`;
  const who = o.advisor ? t("whoAdvisor", { name: o.advisor.name }) : t("whoTeam");

  const timeBox = highlight(
    (moved && old ? `<span style="color:#8a8ea8;text-decoration:line-through;font-size:14px">${escape(old.short)}</span> &nbsp;→&nbsp; ` : "") +
      `<strong style="font-size:18px">📅 ${escape(when.main)}</strong><br><span style="color:#8a8ea8;font-size:13px">${escape(when.sub)} · ${escape(t("minutes", { n: CALL_MINUTES }))} · Google Meet</span>`,
  );

  const subject = o.reminder
    ? t("reminderSubject", { when: when.short })
    : moved
      ? t("movedSubject", { name: first, when: when.short })
      : t("keptSubject", { name: first });

  const html = layout(
    eyebrow(o.reminder ? t("reminderEyebrow") : moved ? t("movedEyebrow") : t("keptEyebrow")) +
      title(escape(o.reminder ? t("reminderTitle", { name: first }) : moved ? t("movedTitle", { name: first }) : t("keptTitle", { name: first }))) +
      (o.advisor ? advisorCard(t("advisorLine", { name: o.advisor.name }), t("advisorRole"), o.advisor.name, o.advisor.photo) : "") +
      para(
        escape(o.reminder ? t("reminderIntro") : moved && old ? t("movedIntro", { old: old.short }) : t("keptIntro")),
        true,
      ) +
      timeBox +
      actions(button(url, moved ? t("movedButton") : t("keptButton"))) +
      para(t("meetAfter"), true) +
      (o.confirmBy ? para(t("deadline", { when: escape(whenIn(o.confirmBy, tz, lang).short) }), true) : "") +
      steps(t("nextTitle"), [t("step1"), t("step2"), t("step3")]) +
      para(`${escape(moved ? t("movedOther") : t("keptOther"))} <a href="${pickUrl}" style="color:#442DFA;font-weight:bold;text-decoration:none">${escape(t("chooseOther"))}</a>`, true),
    `${when.main}`,
    lang,
  );

  const wa = t(moved ? "waMoved" : "waKept", { name: first, who, when: when.main, old: old?.short ?? "", url, booking: pickUrl });

  return { subject, html, wa, moved };
}

/** "Your free call is confirmed": Meet link first, .ics invite, documents reminder. */
export function confirmedEmail(c: Row, advisor: Advisor | null = null) {
  const lang = langOf(c);
  const t = mailT(lang);
  const tz = tzOf(c);
  const first = firstName(c);
  const when = whenIn(c.preferred_call_at, tz, lang);
  const start = new Date(c.preferred_call_at);
  const end = new Date(start.getTime() + CALL_MINUTES * 60_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Outreach//Consultation//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.id}@consultation.outreachstudy.eu`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${t("icsTitle")}`,
    `DESCRIPTION:Your free Malta study consultation.${c.meeting_url ? `\\nJoin: ${c.meeting_url}` : ""}`,
    c.meeting_url ? `LOCATION:${c.meeting_url}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${t("icsTitle")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const html = layout(
    eyebrow(t("confirmedEyebrow")) +
      title(escape(t("confirmedTitle", { name: first }))) +
      (advisor ? advisorCard(t("advisorLine", { name: advisor.name }), t("advisorRole"), advisor.name, advisor.photo) : "") +
      (c.meeting_url
        ? actions(button(c.meeting_url, `🎥 ${t("joinMeet")}`))
        : `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#fff8e6;color:#7a5a00;text-align:center;font-size:14px">🎥 ${escape(t("meetPending"))}</p>`) +
      highlight(
        `<strong style="font-size:18px">📅 ${escape(when.main)}</strong><br><span style="color:#8a8ea8;font-size:13px">${escape(when.sub)} · ${escape(t("minutes", { n: CALL_MINUTES }))} · Google Meet</span>`,
      ) +
      actions(button(`${APP_URL()}/dashboard`, t("openDashboard"), "#14123a")) +
      `<div style="margin:0 0 14px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
        <p style="margin:0 0 6px;color:#14123a"><strong>${escape(t("prepareTitle"))}</strong></p>
        <p style="margin:0;color:#5b6080">${t("prepareText")}</p>
        <p style="margin:10px 0 0"><a href="${APP_URL()}/dashboard/documents" style="color:#442DFA;font-weight:bold;text-decoration:none">${escape(t("uploadDocs"))}</a></p>
      </div>` +
      (c.call_confirm_token
        ? para(
            `${escape(t("icsAttached"))}<br>${escape(t("needOther"))} <a href="${APP_URL()}/confirm-call?t=${c.call_confirm_token}&pick=1" style="color:#442DFA;font-weight:bold;text-decoration:none">${escape(t("changeTime"))}</a>`,
            true,
          )
        : para(escape(t("inviteAttached")), true)),
    when.main,
    lang,
  );
  const meet = c.meeting_url ? t("waMeetJoin", { url: c.meeting_url }) : t("waMeetPending");
  const wa = t("waConfirmed", { name: first, when: when.main, meet, url: `${APP_URL()}/dashboard/documents` });
  return {
    subject: t("confirmedSubject", { when: when.short }),
    html,
    wa,
    attachments: [{ filename: "outreach-call.ics", content: b64(ics) }],
  };
}

export async function sendEmail(msg: { to: string | string[]; subject: string; html: string; attachments?: { filename: string; content: string }[] }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return "not-configured";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM(), ...msg }),
  });
  return res.ok ? "sent" : await res.text();
}
