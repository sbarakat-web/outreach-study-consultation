// Call bookings. Every booking starts as a request ("Awaiting confirmation"): from the candidate's dashboard, the
// confirm link, the Google booking page, or the team picking an agreed time. The team then adds the call to Google
// Calendar by hand (with a Meet link), pastes the link in admin and confirms: that sends the "We're waiting for you"
// email (CC to the main admin), and the WhatsApp text is ready to copy.
// Attendance confirmation: the candidate then confirms they'll attend (link in the email, or a WhatsApp YES the team
// marks); bookings still unconfirmed at attendance_deadline are cancelled automatically (autoCancelUnconfirmed).
import { actions, button, eyebrow, facts, layout, para, title, escape } from "./email.ts";
import { APP_URL, CALL_MINUTES, firstName, sendEmail, tzOf, whenIn } from "./call.ts";
import { adminRecipients } from "./admins.ts";
import { gcalLink } from "./gcal.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export type BookedVia = "google" | "admin" | "dashboard" | "confirm-link";

const WHATSAPP = "+356 9972 8213";
export const BOOKED_CC = () => Deno.env.get("BOOKED_CC") || Deno.env.get("ADMIN_NOTIFY_EMAIL") || "sbarakat@outreachrecruitment.net";

const malta = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/Malta" }).format(new Date(iso));

const H = 3_600_000;

/** When an unconfirmed booking is cancelled: 12h before the call, or 1h before when it is booked late; none if too close. */
export function attendanceDeadline(at: string) {
  const call = new Date(at).getTime();
  let by = call - 12 * H;
  if (by < Date.now() + 3 * H) by = call - H;
  return by < Date.now() + 30 * 60_000 ? null : new Date(by).toISOString();
}

const attendUrl = (c: Row) => `${APP_URL()}/confirm-call?t=${c.call_confirm_token}&attend=1`;

const SITE = { url: "https://outreachstudy.eu", label: "outreachstudy.eu", brand: "Outreach Recruitment — Study in Malta" };

const timeCard = (c: Row, at: string) => {
  const when = whenIn(at, tzOf(c));
  const local = tzOf(c) !== "Europe/Malta" ? `${when.sub.replace(" Malta time", "")} (Malta time)` : "";
  return `<div style="margin:0 0 16px;padding:18px;border-radius:16px;background:#f0eeff;text-align:center;color:#14123a">
          <p style="margin:0;font-size:19px;font-weight:bold">📅 ${escape(when.main)}</p>
          ${local ? `<p style="margin:4px 0 0;color:#5b6080;font-size:14px">${escape(local)}</p>` : ""}
          <p style="margin:6px 0 0;color:#8a8ea8;font-size:13px">⏱ ${CALL_MINUTES} minutes · online on Google Meet</p>
        </div>`;
};

/** "We've received your request" — the time is held while the team confirms it. */
export function requestEmail(c: Row, opts: { moved?: boolean } = {}) {
  const first = firstName(c);
  const when = whenIn(c.preferred_call_at, tzOf(c));
  return {
    subject: opts.moved ? `${first}, we've received your new time — ${when.short}` : `${first}, we've received your call request — ${when.short}`,
    html: layout(
      eyebrow("Request received") +
        title(`Hi ${escape(first)}, thank you!`) +
        para(
          opts.moved
            ? "We've received the new time you chose for your free consultation. Our team is confirming it now."
            : "We've received your request for a free consultation with Outreach. Our team is confirming your time now.",
          true,
        ) +
        timeCard(c, c.preferred_call_at) +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 6px;color:#14123a;font-weight:bold">What happens next</p>
          <p style="margin:0 0 6px;color:#5b6080;font-size:14px">1. We confirm your time (usually within a few hours).</p>
          <p style="margin:0 0 6px;color:#5b6080;font-size:14px">2. You receive an email with your <strong>Google Meet link</strong>, plus a Google Calendar invitation.</p>
          <p style="margin:0;color:#5b6080;font-size:14px">3. You join the call — that's it!</p>
        </div>` +
        actions(button(`${APP_URL()}/dashboard`, "Open my dashboard", "#14123a")) +
        para(`Meanwhile, you can upload your passport and latest certificate in your dashboard. Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp ${WHATSAPP}</a>`, true),
      `${when.main} — awaiting confirmation`,
      "en",
      SITE,
    ),
  };
}

/** "We're waiting for you" — the confirmed-call email with the Meet link. `moved` turns it into "your call has a new time". */
export function waitingEmail(c: Row, opts: { moved?: boolean } = {}) {
  const first = firstName(c);
  const when = whenIn(c.preferred_call_at, tzOf(c));
  const li = (t: string) => `<p style="margin:0 0 6px;color:#5b6080;font-size:14px">✓ ${t}</p>`;
  const meet = c.meeting_url
    ? actions(button(c.meeting_url, "🎥 Join Google Meet")) +
      `<p style="margin:-8px 0 16px;text-align:center;color:#8a8ea8;font-size:12px;word-break:break-all">${escape(c.meeting_url)}</p>`
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
        timeCard(c, c.preferred_call_at) +
        (c.attendance_deadline && !c.attendance_confirmed_at && c.call_confirm_token
          ? `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f59e0b;border-radius:14px;background:#fffbeb;text-align:center;color:#78350f">
              <p style="margin:0 0 6px;font-size:16px;font-weight:bold">⚠️ Important: please confirm you'll attend</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.5">Click the button below (or reply <strong>YES</strong> on WhatsApp). If we don't hear from you by <strong>${escape(whenIn(c.attendance_deadline, tzOf(c)).main)}</strong>, your booking will be <strong>cancelled automatically</strong> so another student can take the time.</p>
              ${button(attendUrl(c), "✅ Yes, I'll attend", "#16a34a")}
            </div>`
          : "") +
        meet +
        `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#f0f9f4;color:#1d6b45;text-align:center;font-size:14px">📩 You'll also receive a <strong>Google Calendar invitation</strong> from Outreach by email — please click <strong>“Yes”</strong> to add the call to your calendar.</p>` +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 6px;color:#14123a;font-weight:bold">What we'll talk about</p>
          <p style="margin:0;color:#5b6080;font-size:14px;line-height:1.6">In ${CALL_MINUTES} minutes, your advisor will get to know you and your goals, explain the best study options in Malta for your profile (English courses, diplomas, bachelor's or master's), go through costs, scholarships and the student visa process, and answer all your questions — no pressure and no commitment.</p>
        </div>` +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 8px;color:#14123a;font-weight:bold">How to prepare (5 minutes)</p>
          ${li("Join from a quiet place with a good internet connection")}
          ${li("Open the Meet link 2–3 minutes early")}
          ${li("If you can, upload your passport and latest certificate in your dashboard — it helps us give you precise advice")}
        </div>` +
        actions(button(`${APP_URL()}/dashboard`, "Open my dashboard", "#14123a")) +
        `<p style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#fff8e6;color:#7a5a00;text-align:center;font-size:14px"><strong>Need to change the time?</strong> No problem — just send us a <a href="https://wa.me/35699728213" style="color:#7a5a00;font-weight:bold">WhatsApp message</a> before the meeting at ${WHATSAPP}, and we'll find a new time together.</p>` +
        para("We're looking forward to speaking with you and helping you take the next step towards studying in Malta. 🇲🇹", true) +
        para("Warm regards,<br><strong style=\"color:#14123a\">Soufiane &amp; the Outreach team</strong>", true),
      `${when.main} — we're waiting for you`,
      "en",
      SITE,
    ),
  };
}

/** The matching WhatsApp text (staff send it themselves from admin). Keep in sync with src/pages/admin/calls.ts. */
export function waitingWhatsApp(c: Row) {
  return [
    `Hi ${firstName(c)} 👋 this is Soufiane from Outreach — Study in Malta.`,
    "",
    "Thank you for booking your free consultation! 🎉 We're waiting for you on:",
    ...(tzOf(c) !== "Europe/Malta"
      ? [`📅 *${whenIn(c.preferred_call_at, tzOf(c)).main}*`, `🇲🇹 ${malta(c.preferred_call_at)} (Malta time)`]
      : [`📅 *${malta(c.preferred_call_at)} (Malta time)*`]),
    c.meeting_url ? `🎥 Google Meet: ${c.meeting_url}` : "🎥 We'll send you the Google Meet link before the call.",
    "📩 You'll also get a Google Calendar invitation by email — please accept it.",
    ...(c.attendance_deadline && !c.attendance_confirmed_at
      ? [
          "",
          `⚠️ *IMPORTANT:* please reply *YES* to confirm you'll attend${c.call_confirm_token ? ` (or tap: ${attendUrl(c)})` : ""}.`,
          `If we don't hear from you by *${whenIn(c.attendance_deadline, tzOf(c)).main}*, the booking will be cancelled automatically.`,
        ]
      : []),
    "",
    `In ${CALL_MINUTES} minutes we'll look at the best study options in Malta for you, the costs, scholarships and the visa steps — and answer all your questions.`,
    "",
    `📎 If you can, upload your passport and latest certificate before the call: ${APP_URL()}/dashboard`,
    "",
    "If you need to change the time, just reply here. See you soon! 😊",
  ].join("\n");
}

/** Send the waiting email to the candidate, CC the main admin. */
export function sendWaitingEmail(c: Row, opts: { moved?: boolean } = {}) {
  const mail = waitingEmail(c, opts);
  const cc = BOOKED_CC();
  return sendEmail({ to: c.email, ...(cc && cc !== c.email ? { cc } : {}), subject: mail.subject, html: mail.html });
}

const SOURCE: Record<BookedVia, string> = { google: "Google booking page", admin: "Team", dashboard: "Candidate dashboard", "confirm-link": "Confirm link" };

/** Admin alert for a new (or moved) request, with the steps to confirm it. */
async function alertRequest(db: Db, row: Row, via: BookedVia, previous: string | null) {
  const moved = !!previous;
  const name = row.full_name;
  const head = via === "google" ? `New Google booking: ${name}` : moved ? `${name} changed their call time` : `${name} requested a call`;
  return sendEmail({
    to: await adminRecipients(db),
    subject: `⏳ ${head} — ${malta(row.preferred_call_at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · awaiting confirmation`,
    html: layout(
      eyebrow("Awaiting confirmation") +
        title(escape(head)) +
        facts([
          ["When", `${malta(row.preferred_call_at)} (Malta)`],
          ["Was", previous ? `${malta(previous)} (Malta)` : null],
          ["From", SOURCE[via]],
          ["Email", row.email],
          ["WhatsApp", row.whatsapp],
          ["Course", row.desired_course],
          ["Google Meet", row.meeting_url],
        ]) +
        para(
          via === "google"
            ? "It's already in Google Calendar with a Meet link. Open the lead and click <strong>Confirm &amp; send</strong>."
            : "<strong>1.</strong> Add it to Google Calendar (with Meet) and send the invite · <strong>2.</strong> Paste the Meet link in admin · <strong>3.</strong> Confirm &amp; send.",
          true,
        ) +
        actions(
          button(`${APP_URL()}/admin?lead=${row.id}`, "Confirm in admin"),
          via === "google" ? "" : button(gcalLink(row, row.preferred_call_at), "📅 Add to Google Calendar", "#14123a"),
        ),
      `${name}: ${malta(row.preferred_call_at)} — awaiting confirmation`,
    ),
  });
}

/**
 * Hold `at` as a request awaiting confirmation. Emails the candidate "request received" (not for Google bookings,
 * Google already confirmed those to them; not when `silent`) and alerts the admins (not for the team's own picks).
 */
export async function requestCall(db: Db, c: Row, at: string, via: BookedVia, opts: { meetUrl?: string | null; googleEventId?: string; silent?: boolean } = {}) {
  const had = ["requested", "confirmed"].includes(c.call_status) && c.preferred_call_at ? c.preferred_call_at : null;
  const previous = had && new Date(had).getTime() !== new Date(at).getTime() ? had : null;
  const { data: row, error } = await db
    .from("consultations")
    .update({
      call_status: "requested",
      preferred_call_at: at,
      requested_call_times: [at],
      suggested_call_at: null,
      call_declined_at: null,
      call_requested_at: new Date().toISOString(),
      request_reminder_at: null,
      reminder_24h_at: null,
      reminder_1h_at: null,
      booked_via: via,
      call_confirm_token: c.call_confirm_token ?? crypto.randomUUID(),
      // A "no longer interested" candidate booking again is an active lead again (the reason stays on record).
      ...(c.status === "not_interested" ? { status: "new" } : {}),
      ...(opts.meetUrl !== undefined ? { meeting_url: opts.meetUrl } : previous ? { meeting_url: null } : {}),
      ...(opts.googleEventId ? { google_event_id: opts.googleEventId } : {}),
    })
    .eq("id", c.id)
    .select("*")
    .single();
  if (error || !row) return { error: error?.message ?? "Could not save the request" };
  if (!opts.silent) {
    if (via !== "google" && via !== "admin") {
      const mail = requestEmail(row, { moved: !!previous });
      await sendEmail({ to: row.email, subject: mail.subject, html: mail.html });
    }
    if (via !== "admin") await alertRequest(db, row, via, previous);
  }
  return { row, moved: !!previous };
}

/** The team confirms the requested time with the Meet link they created in Google Calendar: the waiting email goes out. */
export async function confirmCall(db: Db, c: Row, meetUrl: string | null, staffEmail?: string | null) {
  const at = c.preferred_call_at ?? c.requested_call_times?.[0];
  if (!at) return { error: "No requested time to confirm" };
  const { data: row, error } = await db
    .from("consultations")
    .update({
      call_status: "confirmed",
      preferred_call_at: at,
      suggested_call_at: at,
      meeting_url: meetUrl ?? c.meeting_url,
      call_declined_at: null,
      reminder_24h_at: null,
      reminder_1h_at: null,
      request_reminder_at: null,
      attendance_confirmed_at: null,
      attendance_deadline: attendanceDeadline(at),
      booked_via: c.booked_via ?? "admin",
      call_confirm_token: c.call_confirm_token ?? crypto.randomUUID(),
      call_reviewed_at: c.call_reviewed_at ?? new Date().toISOString(),
      ...(staffEmail ? { call_suggested_by: c.call_suggested_by ?? staffEmail } : {}),
      ...(["new", "no_show", "not_interested"].includes(c.status) ? { status: "consultation_booked" } : {}),
    })
    .eq("id", c.id)
    .select("*")
    .single();
  if (error || !row) return { error: error?.message ?? "Could not confirm the call" };
  const email = await sendWaitingEmail(row);
  return { row, emailed: email === "sent" };
}

/** Requests still not confirmed after 4 hours: one reminder to the admins per request. */
export async function remindPendingRequests(db: Db) {
  const { data: stale } = await db
    .from("consultations")
    .select("*")
    .eq("call_status", "requested")
    .is("request_reminder_at", null)
    .is("call_declined_at", null)
    .lt("call_requested_at", new Date(Date.now() - 4 * 3_600_000).toISOString())
    .gt("preferred_call_at", new Date().toISOString())
    .order("preferred_call_at")
    .limit(20);
  if (!stale?.length) return 0;
  const ids = stale.map((r: Row) => r.id);
  await db.from("consultations").update({ request_reminder_at: new Date().toISOString() }).in("id", ids);
  await sendEmail({
    to: await adminRecipients(db),
    subject: `⏳ ${stale.length} call request${stale.length > 1 ? "s" : ""} still awaiting confirmation`,
    html: layout(
      eyebrow("Reminder") +
        title(`${stale.length} call request${stale.length > 1 ? "s are" : " is"} waiting for you`) +
        facts(stale.map((r: Row) => [r.full_name, `${malta(r.preferred_call_at)} (Malta)`] as [string, string])) +
        actions(button(`${APP_URL()}/admin/calendar`, "Open calendar")),
      "Call requests awaiting confirmation",
    ),
  });
  return stale.length;
}

/**
 * Bookings whose attendance wasn't confirmed by the deadline: free the time, tell the candidate (with a link to choose
 * a new time) and alert the admins.
 */
export async function autoCancelUnconfirmed(db: Db) {
  const { data: due } = await db
    .from("consultations")
    .select("*")
    .eq("call_status", "confirmed")
    .is("attendance_confirmed_at", null)
    .not("attendance_deadline", "is", null)
    .lt("attendance_deadline", new Date().toISOString())
    .gt("preferred_call_at", new Date().toISOString())
    .limit(20);
  let n = 0;
  for (const c of due ?? []) {
    // Claim it: only one run cancels (and emails) each booking.
    const { data: claimed } = await db
      .from("consultations")
      .update({ call_status: "none", preferred_call_at: null, suggested_call_at: null, requested_call_times: [], meeting_url: null, attendance_deadline: null, repick_requested_at: new Date().toISOString() })
      .eq("id", c.id)
      .eq("call_status", "confirmed")
      .is("attendance_confirmed_at", null)
      .select("id");
    if (!claimed?.length) continue;
    n++;
    const first = firstName(c);
    const when = whenIn(c.preferred_call_at, tzOf(c));
    await sendEmail({
      to: c.email,
      subject: `${first}, your call on ${when.short} was cancelled`,
      html: layout(
        eyebrow("Booking cancelled") +
          title(`Hi ${escape(first)},`) +
          para(`We didn't receive your confirmation, so your free consultation on <strong>${escape(when.main)}</strong> was cancelled to free the time for another student.`, true) +
          para("No problem — you can choose a new time whenever you're ready:", true) +
          actions(button(`${APP_URL()}/confirm-call?t=${c.call_confirm_token}&pick=1`, "📅 Choose a new time")) +
          para(`Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp ${WHATSAPP}</a>`, true),
        "Your booking was cancelled — choose a new time",
        "en",
        SITE,
      ),
    });
    await sendEmail({
      to: await adminRecipients(db),
      subject: `❌ Auto-cancelled (no confirmation): ${c.full_name} — ${malta(c.preferred_call_at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      html: layout(
        eyebrow("Attendance not confirmed") +
          title(`${escape(c.full_name)}'s booking was cancelled`) +
          facts([
            ["Was", `${malta(c.preferred_call_at)} (Malta)`],
            ["Email", c.email],
            ["WhatsApp", c.whatsapp],
          ]) +
          para("They were sent a link to choose a new time. Remember to delete the event from Google Calendar.", true) +
          actions(button(`${APP_URL()}/admin?lead=${c.id}`, "Open lead")),
        `${c.full_name}: booking cancelled`,
      ),
    });
  }
  return n;
}
