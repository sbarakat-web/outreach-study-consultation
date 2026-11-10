// Candidate emails sent by staff actions:
//   { type: "call-confirmed", consultationId }    time in the candidate's time zone, Meet link, .ics, prepare documents
//   { type: "rebook", consultationId }            missed session → pick a new time
//   { type: "booking-link", consultationId }      send the real Google booking page for the call
//   { type: "suggest-time", consultationId, at }  propose a time; the candidate accepts with one click
//   { type: "hold", consultationId, at }          time agreed with the candidate: hold it as awaiting confirmation
//   { type: "confirm", consultationId, meetUrl }  confirm the held time with the Meet link created in Google Calendar:
//                                                  "We're waiting for you" email (CC main admin) + WhatsApp text
//   { type: "pick-another", consultationId }      their time isn't available: release it and send a link to choose
//                                                  another free time themselves (back to awaiting confirmation after)
//   { type: "cancel-appointment", consultationId } cancel a booked appointment and ask the candidate to rebook
//   { type: "booking-reminder", consultationId }  applied but never booked: reminder with a link to choose a free time
//                                                  (when and how often is kept in tracking.booking_reminder_*)
//   { type: "reinvite", consultationId }          a "no longer interested" candidate: back to New, with a link to book
//                                                  a new call (their account and the reason are kept)
// Returns waUrl (WhatsApp Web link with the same short message). Staff only.
// Secrets: RESEND_API_KEY; optional MAIL_FROM, APP_URL, BOOKING_LINK
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, highlight, layout, para, title, escape } from "../_shared/email.ts";
import { APP_URL, BOOKING_LINK, CALL_MINUTES, confirmByFor, firstName, loadAdvisor, sendEmail, suggestEmail, tzOf, whenIn } from "../_shared/call.ts";
import { confirmCall, requestCall, waitingEmail, waitingWhatsApp, BOOKED_CC } from "../_shared/booked.ts";
import { isSlotFree } from "../_shared/slots.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const email = auth?.user?.email_confirmed_at ? auth.user.email?.toLowerCase() : null;
  if (!email) return json({ error: "Not signed in" }, 401);
  const [{ data: a }, { data: p }] = await Promise.all([
    db.from("admins").select("email").eq("email", email).maybeSingle(),
    db.from("session_presenters").select("email").eq("email", email).maybeSingle(),
  ]);
  if (!a && !p) return json({ error: "Staff only" }, 403);

  const { type, consultationId, at, meetUrl } = await req.json().catch(() => ({}));
  const { data: c } = await db.from("consultations").select("*").eq("id", consultationId).maybeSingle();
  if (!c) return json({ error: "Candidate not found" }, 404);
  const first = firstName(c);
  const tz = tzOf(c);
  const digits = (c.whatsapp ?? "").replace(/\D/g, "");

  let subject = "";
  let html = "";
  let wa = "";
  let cc: string | undefined;
  const waUrl = (text: string) => (digits ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}` : null);

  if (type === "hold") {
    const when = new Date(at);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) return json({ error: "Pick a future time" }, 400);
    if (!(await isSlotFree(db, when.toISOString(), c.id))) return json({ error: "This time is no longer free in the calendar — pick another." }, 409);
    const r = await requestCall(db, c, when.toISOString(), c.booked_via === "google" ? "google" : "admin", { silent: true });
    return "error" in r && r.error ? json({ error: r.error }, 500) : json({ ok: true });
  }

  if (type === "confirm") {
    const link = typeof meetUrl === "string" ? meetUrl.trim() : "";
    if (link && !/^https:\/\/\S+$/.test(link)) return json({ error: "The meeting link must start with https://" }, 400);
    if (!link && !c.meeting_url) return json({ error: "Paste the Google Meet link first." }, 400);
    const r = await confirmCall(db, c, link || null, email);
    if ("error" in r && r.error) return json({ error: r.error }, 400);
    const row = (r as { row: Record<string, unknown> }).row;
    const emailed = (r as { emailed: boolean }).emailed;
    return json({ ok: emailed, email: emailed ? "sent" : "failed", waUrl: waUrl(waitingWhatsApp(row)), waText: waitingWhatsApp(row) });
  }

  if (type === "call-confirmed") {
    if (!c.preferred_call_at) return json({ error: "No confirmed time" }, 400);
    // Give the candidate a self-service link ("Change my call time") in the confirmed email.
    if (!c.call_confirm_token) {
      c.call_confirm_token = crypto.randomUUID();
      await db.from("consultations").update({ call_confirm_token: c.call_confirm_token }).eq("id", c.id);
    }
    ({ subject, html } = waitingEmail(c));
    wa = waitingWhatsApp(c);
    cc = BOOKED_CC();
  } else if (type === "rebook") {
    subject = `${first}, let's find a new time for your call`;
    html = layout(
      eyebrow("New time") +
        title(`Hi ${escape(first)}, we missed you!`) +
        para("We couldn't reach you at your scheduled call. No problem — pick a new time that suits you and we'll confirm it.", true) +
        actions(button(`${APP_URL()}/dashboard`, "Pick a new time")),
      "Pick a new time for your free call",
    );
    wa = `Hi ${first}, we missed you at your Outreach call today. Please pick a new time here: ${APP_URL()}/dashboard`;
  } else if (type === "booking-link") {
    const asked = c.requested_call_times?.[0] ? whenIn(c.requested_call_times[0], tz).main : null;
    subject = `${first}, book your free call with Outreach`;
    html = layout(
      eyebrow("Book your call") +
        title(`Hi ${escape(first)}, let's book your free call`) +
        para("We've reviewed your request. Please choose your call time on our booking page — it takes 30 seconds and adds the call to your calendar.", true) +
        (asked ? highlight(`<span style="color:#8a8ea8;font-size:13px">You asked for</span><br><strong style="font-size:17px">${escape(asked)}</strong>`) : "") +
        actions(button(BOOKING_LINK(), "Book my free call")) +
        para("Questions? Reply to this email or message us on WhatsApp.", true),
      "Choose your free call time",
    );
    wa = `Hi ${first}, this is Outreach. Thank you for your application for ${c.desired_course || "your studies"}! Please book your free call here: ${BOOKING_LINK()}`;
  } else if (type === "pick-another" || type === "cancel-appointment") {
    const cancelling = type === "cancel-appointment";
    if (!cancelling && c.call_status === "confirmed") return json({ error: "This call is already confirmed — use Change time instead." }, 409);
    if (cancelling && c.call_status !== "confirmed") return json({ error: "Only a confirmed appointment can be cancelled." }, 409);
    const old = c.preferred_call_at ?? c.requested_call_times?.[0] ?? null;
    const token = c.call_confirm_token ?? crypto.randomUUID();
    const { error } = await db
      .from("consultations")
      .update({
        call_status: "none",
        preferred_call_at: null,
        requested_call_times: [],
        suggested_call_at: null,
        meeting_url: null,
        call_requested_at: null,
        request_reminder_at: null,
        call_confirm_token: token,
        repick_requested_at: new Date().toISOString(),
        ...(cancelling
          ? {
              tracking: {
                ...(c.tracking ?? {}),
                appointment_cancelled_at: new Date().toISOString(),
                appointment_cancelled_call_at: old ?? "",
                appointment_cancelled_by: email,
              },
            }
          : {}),
      })
      .eq("id", c.id);
    if (error) return json({ error: error.message }, 500);
    const pickUrl = `${APP_URL()}/confirm-call?t=${token}&pick=1`;
    const oldText = old ? whenIn(old, tz).main : null;
    subject = cancelling ? `${first}, your appointment was cancelled — choose another time` : `${first}, please choose another time for your call`;
    html = layout(
      eyebrow("New time needed") +
        title(`Hi ${escape(first)}, ${cancelling ? "your appointment was cancelled" : "sorry!"}`) +
        para(
          `${cancelling ? "We had to cancel your appointment" : "The time you chose"}${oldText ? ` (<strong>${escape(oldText)}</strong>)` : ""}${cancelling ? "." : " is no longer available."} Please pick another free time — it only takes a few seconds.`,
          true,
        ) +
        actions(button(pickUrl, "📅 Choose another time")) +
        para("Only available times are shown. We'll confirm your new time and email you your Google Meet link.", true) +
        para(`Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp +356 9972 8213</a>`, true),
      "Please choose another time for your free call",
      "en",
      { url: "https://outreachstudy.eu", label: "outreachstudy.eu", brand: "Outreach Recruitment — Study in Malta" },
    );
    wa = [
      `Hi ${first} 👋 this is Soufiane from Outreach — Study in Malta.`,
      "",
      cancelling
        ? `We had to cancel your appointment${old ? ` on ${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(old))} (Malta time)` : ""}.`
        : `Sorry, the time you chose${old ? ` (${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(old))}, Malta time)` : ""} is no longer available.`,
      "",
      `📅 Please choose another free time here (only available times are shown): ${pickUrl}`,
      "",
      "We'll confirm it and send you your Google Meet link. Thank you! 😊",
    ].join("\n");
  } else if (type === "booking-reminder") {
    if (c.call_status === "confirmed" || c.preferred_call_at || c.requested_call_times?.length) {
      return json({ error: "This candidate already has a call booked or requested." }, 409);
    }
    const token = c.call_confirm_token ?? crypto.randomUUID();
    const count = Number(c.tracking?.booking_reminder_count ?? 0) + 1;
    const { error } = await db
      .from("consultations")
      .update({
        call_confirm_token: token,
        tracking: { ...(c.tracking ?? {}), booking_reminder_at: new Date().toISOString(), booking_reminder_count: String(count) },
      })
      .eq("id", c.id);
    if (error) return json({ error: error.message }, 500);
    const pickUrl = `${APP_URL()}/confirm-call?t=${token}&pick=1`;
    const course = c.desired_course || "your studies in Malta";
    // After a cancelled appointment the reminder asks them to rebook instead.
    const was = c.tracking?.appointment_cancelled_call_at ? whenIn(c.tracking.appointment_cancelled_call_at, tz).main : null;
    const rebook = !!c.tracking?.appointment_cancelled_at;
    const li = (t: string) => `<p style="margin:0 0 6px;color:#5b6080;font-size:14px">✓ ${t}</p>`;
    subject = rebook ? `${first}, let's find a new time for your free consultation` : `${first}, your free consultation is waiting — book your time`;
    html = layout(
      eyebrow(rebook ? "Book a new time" : "Free consultation") +
        title(rebook ? `Hi ${escape(first)}, we'd still love to talk!` : `Hi ${escape(first)}, let's talk about your plans!`) +
        para(
          rebook
            ? `Your appointment${was ? ` on <strong>${escape(was)}</strong>` : ""} was cancelled, and you haven't chosen a new time yet. Pick the time that suits you best — it takes less than a minute.`
            : `Thank you for applying for <strong>${escape(course)}</strong>. You haven't booked your free consultation yet — choose a time that suits you, it takes less than a minute.`,
          true,
        ) +
        actions(button(pickUrl, rebook ? "📅 Choose a new time" : "📅 Book my free call")) +
        `<div style="margin:0 0 16px;padding:16px 18px;border:2px solid #f0eeff;border-radius:14px">
          <p style="margin:0 0 8px;color:#14123a;font-weight:bold">In ${CALL_MINUTES} minutes on Google Meet, we'll:</p>
          ${li("Find the best programme in Malta for your profile")}
          ${li("Explain costs, scholarships and payment options")}
          ${li("Guide you through the student visa steps")}
        </div>` +
        para("Only free times are shown, in your own time zone. Free, no commitment.", true) +
        para(`Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp +356 9972 8213</a>`, true),
      rebook ? "Choose a new time for your free consultation" : "Book your free consultation with Outreach",
      "en",
      { url: "https://outreachstudy.eu", label: "outreachstudy.eu", brand: "Outreach Recruitment — Study in Malta" },
    );
    wa = [
      `Hi ${first} 👋 this is Soufiane from Outreach — Study in Malta.`,
      "",
      rebook
        ? `Your appointment${was ? ` on ${was}` : ""} was cancelled, and we'd still love to talk with you about ${course}! 🎓`
        : `Thank you for applying for ${course}! 🎓 You haven't booked your free consultation yet.`,
      "",
      `📅 Choose ${rebook ? "a new" : "a"} time that suits you here (takes less than a minute): ${pickUrl}`,
      "",
      `In ${CALL_MINUTES} minutes we'll find the best programme for you and explain costs, scholarships and the visa steps. Free, no commitment 😊`,
    ].join("\n");
  } else if (type === "reinvite") {
    const token = c.call_confirm_token ?? crypto.randomUUID();
    const { error } = await db
      .from("consultations")
      .update({
        status: "new",
        call_status: "none",
        preferred_call_at: null,
        requested_call_times: [],
        suggested_call_at: null,
        meeting_url: null,
        call_requested_at: null,
        attendance_deadline: null,
        attendance_confirmed_at: null,
        call_confirm_token: token,
      })
      .eq("id", c.id);
    if (error) return json({ error: error.message }, 500);
    const pickUrl = `${APP_URL()}/confirm-call?t=${token}&pick=1`;
    subject = `${first}, would you like to book a new call?`;
    html = layout(
      eyebrow("Book a new call") +
        title(`Hi ${escape(first)},`) +
        para("We'd be happy to help you with your studies in Malta whenever you're ready. You can book a new free consultation at a time that suits you:", true) +
        actions(button(pickUrl, "📅 Book a new call")) +
        para(`Your account is still active — you can also sign in at <a href="${APP_URL()}/dashboard" style="color:#442DFA;font-weight:bold">your dashboard</a>.`, true) +
        para(`Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp +356 9972 8213</a>`, true),
      "Book a new free call with Outreach",
      "en",
      { url: "https://outreachstudy.eu", label: "outreachstudy.eu", brand: "Outreach Recruitment — Study in Malta" },
    );
    wa = [
      `Hi ${first} 👋 this is Soufiane from Outreach — Study in Malta.`,
      "",
      "Whenever you're ready, you can book a new free consultation here (only available times are shown):",
      pickUrl,
      "",
      "Thank you! 😊",
    ].join("\n");
  } else if (type === "suggest-time") {
    const when = new Date(at);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) return json({ error: "Pick a future time" }, 400);
    if (c.call_status === "confirmed") return json({ error: "This call is already confirmed" }, 409);
    const token = c.call_confirm_token ?? crypto.randomUUID();
    const confirmBy = confirmByFor(when.toISOString());
    const { error } = await db
      .from("consultations")
      .update({
        suggested_call_at: when.toISOString(),
        // The candidate's own requested time is released; they now answer the suggestion.
        preferred_call_at: null,
        call_suggested_at: new Date().toISOString(),
        call_suggested_by: email,
        call_confirm_by: confirmBy,
        call_confirm_token: token,
        suggest_reminder_at: null,
        call_reviewed_at: c.call_reviewed_at ?? new Date().toISOString(),
      })
      .eq("id", c.id);
    if (error) return json({ error: error.message }, 500);
    ({ subject, html, wa } = suggestEmail(c, { at: when.toISOString(), token, advisor: await loadAdvisor(db, email), confirmBy }));
  } else {
    return json({ error: "Unknown type" }, 400);
  }

  const sent = await sendEmail({ to: c.email, ...(cc && cc !== c.email ? { cc } : {}), subject, html });
  if (sent !== "sent") console.error(`notify ${type}: email to ${c.email} failed: ${sent}`);
  // Reminders keep the email result, so the lists can show whether it really went out.
  if (type === "booking-reminder") {
    const { data: row } = await db.from("consultations").select("tracking").eq("id", c.id).single();
    await db.from("consultations").update({ tracking: { ...(row?.tracking ?? {}), booking_reminder_email: sent === "sent" ? "sent" : "failed" } }).eq("id", c.id);
  }
  return json({ ok: sent === "sent", email: sent, waUrl: waUrl(wa), waText: wa });
});
