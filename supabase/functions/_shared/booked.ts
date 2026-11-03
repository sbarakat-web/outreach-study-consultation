// A confirmed call, wherever it was booked (Google booking page, admin "Book now", the candidate's dashboard,
// the one-click confirm link): one "We're waiting for you" email (CC to the main admin) and one WhatsApp text.
import { actions, button, eyebrow, layout, para, title, escape } from "./email.ts";
import { APP_URL, CALL_MINUTES, MAIL_FROM, confirmedEmail, firstName, sendEmail, tzOf, whenIn } from "./call.ts";
import { calendarIdOf, createCallEvent, googleConfigured, moveCallEvent } from "./google.ts";
import { inviteIcs } from "./ical.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export type BookedVia = "google" | "admin" | "dashboard" | "confirm-link";

const WHATSAPP = "+356 9972 8213";
export const BOOKED_CC = () => Deno.env.get("BOOKED_CC") || Deno.env.get("ADMIN_NOTIFY_EMAIL") || "sbarakat@outreachrecruitment.net";

const malta = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/Malta" }).format(new Date(iso));

/** "We're waiting for you" — the confirmed-call email. `moved` turns it into "your call has a new time". */
export function waitingEmail(c: Row, opts: { moved?: boolean } = {}) {
  const first = firstName(c);
  const tz = tzOf(c);
  const when = whenIn(c.preferred_call_at, tz);
  const local = tz !== "Europe/Malta" ? `${when.sub.replace(" Malta time", "")} (Malta time)` : "";
  const li = (t: string) => `<p style="margin:0 0 6px;color:#5b6080;font-size:14px">✓ ${t}</p>`;
  const meet = c.meeting_url
    ? actions(button(c.meeting_url, "🎥 Join the meeting"))
    : `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#fff8e6;color:#7a5a00;text-align:center;font-size:14px">🎥 Your Google Meet link will be sent to you before the call.</p>`;
  return {
    subject: opts.moved
      ? `${first}, your free consultation has a new time — ${when.short}`
      : `${first}, your free consultation is confirmed — we're waiting for you! 🎓`,
    html: layout(
      eyebrow(opts.moved ? "New time confirmed" : "Consultation confirmed") +
        title(`Hi ${escape(first)},`) +
        para(
          opts.moved
            ? "Your free consultation with Outreach has been moved. Here is your new time — we're looking forward to meeting you!"
            : "Thank you for booking your free consultation with Outreach — we're really happy to meet you!",
          true,
        ) +
        `<div style="margin:0 0 16px;padding:18px;border-radius:16px;background:#f0eeff;text-align:center;color:#14123a">
          <p style="margin:0;font-size:19px;font-weight:bold">📅 ${escape(when.main)}</p>
          ${local ? `<p style="margin:4px 0 0;color:#5b6080;font-size:14px">${escape(local)}</p>` : ""}
          <p style="margin:6px 0 0;color:#8a8ea8;font-size:13px">⏱ ${CALL_MINUTES} minutes · online on Google Meet</p>
        </div>` +
        meet +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 6px;color:#14123a;font-weight:bold">What we'll talk about</p>
          <p style="margin:0;color:#5b6080;font-size:14px;line-height:1.6">In ${CALL_MINUTES} minutes, your advisor will get to know you and your goals, explain the best study options in Malta for your profile (English courses, diplomas, bachelor's or master's), go through costs, scholarships and the student visa process, and answer all your questions — no pressure and no commitment.</p>
        </div>` +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 8px;color:#14123a;font-weight:bold">How to prepare (5 minutes)</p>
          ${li("Join from a quiet place with a good internet connection")}
          ${li("Open the link 2–3 minutes early")}
          ${li("If you can, upload your passport and latest certificate in your dashboard — it helps us give you precise advice")}
        </div>` +
        actions(button(`${APP_URL()}/dashboard`, "Open my dashboard", "#14123a")) +
        `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#fff8e6;color:#7a5a00;text-align:center;font-size:14px"><strong>Need to change the time?</strong> No problem — just send us a <a href="https://wa.me/35699728213" style="color:#7a5a00;font-weight:bold">WhatsApp message</a> before the meeting at ${WHATSAPP}, and we'll find a new time together.</p>` +
        para("We're looking forward to speaking with you and helping you take the next step towards studying in Malta. 🇲🇹", true) +
        para("Warm regards,<br><strong style=\"color:#14123a\">Soufiane &amp; the Outreach team</strong>", true),
      `${when.main} — we're waiting for you`,
      "en",
      { url: "https://outreachstudy.eu", label: "outreachstudy.eu", brand: "Outreach Recruitment — Study in Malta" },
    ),
  };
}

/** The matching WhatsApp text (staff send it themselves from admin). Keep in sync with src/pages/admin/calls.ts. */
export function waitingWhatsApp(c: Row) {
  return [
    `Hi ${firstName(c)} 👋 this is Soufiane from Outreach — Study in Malta.`,
    "",
    "Thank you for booking your free consultation! 🎉 We're waiting for you on:",
    `📅 *${malta(c.preferred_call_at)} (Malta time)*`,
    c.meeting_url ? `🎥 Google Meet: ${c.meeting_url}` : "🎥 We'll send you the Google Meet link before the call.",
    "",
    `In ${CALL_MINUTES} minutes we'll look at the best study options in Malta for you, the costs, scholarships and the visa steps — and answer all your questions.`,
    "",
    `📎 If you can, upload your passport and latest certificate before the call: ${APP_URL()}/dashboard`,
    "",
    "If you need to change the time, just reply here. See you soon! 😊",
  ].join("\n");
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

/**
 * Email the booking calendar's owner (Nikolai) a calendar invitation for a call booked in the app. Gmail adds it to
 * the calendar, so the Google booking page stops offering that time. Used when the app can't write to the calendar.
 */
export async function inviteOwner(c: Row, at: string, opts: { hold?: boolean } = {}) {
  const ics = inviteIcs(c, { at, minutes: CALL_MINUTES, organizer: /<([^>]+)>/.exec(MAIL_FROM())?.[1] ?? MAIL_FROM(), attendee: calendarIdOf(), hold: opts.hold, appUrl: APP_URL() });
  const when = `${malta(at)} (Malta)`;
  return sendEmail({
    to: calendarIdOf(),
    subject: `${opts.hold ? "Hold" : "Booked"}: Outreach call with ${c.full_name} — ${when}`,
    html: layout(
      eyebrow(opts.hold ? "Time held" : "Call booked in the app") +
        title(escape(`${c.full_name} — ${when}`)) +
        para(
          opts.hold
            ? "This time is held while the candidate confirms. It is in your calendar so the booking page doesn't offer it."
            : "This call was booked in the Outreach app. It is in your calendar so the booking page doesn't offer this time.",
          true,
        ) +
        actions(button(`${APP_URL()}/admin?lead=${c.id}`, "Open lead")),
      when,
    ),
    attachments: [{ filename: "invite.ics", content: b64(ics), content_type: "text/calendar; method=REQUEST" }],
  });
}

/** Send the waiting email to the candidate, CC the main admin. Google bookings skip the .ics (Google already invited them). */
export async function sendWaitingEmail(c: Row, opts: { moved?: boolean; via?: BookedVia } = {}) {
  const mail = waitingEmail(c, opts);
  const cc = BOOKED_CC();
  return sendEmail({
    to: c.email,
    ...(cc && cc !== c.email ? { cc } : {}),
    subject: mail.subject,
    html: mail.html,
    ...(opts.via === "google" ? {} : { attachments: confirmedEmail(c).attachments }),
  });
}

/**
 * Confirm a call at `at` booked in the app (admin "Book now", dashboard, confirm link): save it, put it in the
 * Google Calendar (moving the tentative hold or an earlier event), and send the waiting email.
 */
export async function bookCall(db: Db, c: Row, at: string, via: BookedVia, staffEmail?: string | null) {
  const moved = c.call_status === "confirmed" && !!c.preferred_call_at && new Date(c.preferred_call_at).getTime() !== new Date(at).getTime();
  const { data: updated, error } = await db
    .from("consultations")
    .update({
      call_status: "confirmed",
      preferred_call_at: at,
      suggested_call_at: at,
      call_declined_at: null,
      reminder_24h_at: null,
      reminder_1h_at: null,
      booked_via: via,
      call_confirm_token: c.call_confirm_token ?? crypto.randomUUID(),
      call_reviewed_at: c.call_reviewed_at ?? new Date().toISOString(),
      ...(staffEmail ? { call_suggested_by: c.call_suggested_by ?? staffEmail } : {}),
      ...(["new", "no_show", "not_interested"].includes(c.status) ? { status: "consultation_booked" } : {}),
    })
    .eq("id", c.id)
    .select("*")
    .single();
  if (error || !updated) return { error: error?.message ?? "Could not save the call" };

  let row = updated;
  let written = false;
  if (googleConfigured()) {
    const r = (
      updated.google_event_id
        ? await moveCallEvent(db, updated, at, staffEmail, "confirmed").catch(() => null)
        : await createCallEvent(db, updated, at, staffEmail).catch(() => null)
    ) as { meetUrl?: string | null; eventId?: string; ok?: boolean; skipped?: string } | null;
    written = !!(r?.eventId || (r?.ok && !r.skipped));
    if (r?.meetUrl) row = { ...row, meeting_url: r.meetUrl };
    const { data: fresh } = await db.from("consultations").select("*").eq("id", c.id).single();
    if (fresh) row = { ...fresh, meeting_url: row.meeting_url ?? fresh.meeting_url };
  }
  // No write access to the booking calendar: block the time with an invitation instead.
  if (!written) await inviteOwner(row, at).catch(() => null);
  const email = await sendWaitingEmail(row, { moved, via });
  return { row, moved, emailed: email === "sent" };
}
