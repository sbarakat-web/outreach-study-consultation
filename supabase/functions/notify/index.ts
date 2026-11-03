// Candidate emails sent by staff actions:
//   { type: "call-confirmed", consultationId }    time in the candidate's time zone, Meet link, .ics, prepare documents
//   { type: "rebook", consultationId }            missed session → pick a new time
//   { type: "booking-link", consultationId }      send the real Google booking page for the call
//   { type: "suggest-time", consultationId, at }  propose a time; the candidate accepts with one click
//   { type: "hold", consultationId, at }          time agreed with the candidate: hold it as awaiting confirmation
//   { type: "confirm", consultationId, meetUrl }  confirm the held time with the Meet link created in Google Calendar:
//                                                  "We're waiting for you" email (CC main admin) + WhatsApp text
// Returns waUrl (WhatsApp Web link with the same short message). Staff only.
// Secrets: RESEND_API_KEY; optional MAIL_FROM, APP_URL, BOOKING_LINK
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, highlight, layout, para, title, escape } from "../_shared/email.ts";
import { APP_URL, BOOKING_LINK, confirmByFor, firstName, loadAdvisor, sendEmail, suggestEmail, tzOf, whenIn } from "../_shared/call.ts";
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
  return json({ ok: sent === "sent", email: sent, waUrl: waUrl(wa), waText: wa });
});
