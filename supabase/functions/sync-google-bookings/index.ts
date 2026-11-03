// Bookings made on the Google appointment page ("Study in Malta", Nikolai's calendar) → confirmed calls in the app.
// Scheduled every 5 minutes (pg_cron). For each booking event on the calendar:
//   new        find the lead by email (or create it), confirm the call with the Google Meet link,
//              send the "We're waiting for you" email (CC main admin) and alert the admins
//   moved      update the time and send the "new time" email
//   cancelled  set the call back to "not booked" and alert the admins
// Events created by the app itself carry extendedProperties.private.outreach and are skipped.
// The first run only links existing bookings (no emails), so nobody gets a late duplicate.
// Source: the calendar's secret iCal address when saved in google_sync.ical_url (works without Workspace sharing;
// a booking that disappears from the feed counts as cancelled), otherwise the Calendar API.
// Secrets: GOOGLE_SERVICE_ACCOUNT (+ calendar shared with it); optional BOOKING_TITLE (default "Study in Malta")
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, layout, title, escape } from "../_shared/email.ts";
import { adminRecipients } from "../_shared/admins.ts";
import { APP_URL, sendEmail } from "../_shared/call.ts";
import { calendarAuth, calendarIdOf } from "../_shared/google.ts";
import { parseIcs } from "../_shared/ical.ts";
import { sendWaitingEmail } from "../_shared/booked.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const BOOKING_TITLE = () => (env("BOOKING_TITLE") || "Study in Malta").toLowerCase();
const malta = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta" }).format(new Date(iso));

// deno-lint-ignore no-explicit-any
type Event = Record<string, any>;

/** The person who booked: the attendee that isn't the calendar owner. */
function bookerOf(ev: Event) {
  const a = (ev.attendees ?? []).find((x: Event) => !x.self && !x.organizer && !x.resource && x.email);
  if (!a) return null;
  // Summary looks like "Study in Malta (Sara Benali)" when the booker gave a name.
  const fromTitle = /\(([^)]+)\)\s*$/.exec(ev.summary ?? "")?.[1];
  const phone = /(?:phone|tel|whatsapp)[^:\n]*:\s*([+\d][\d\s().-]{6,})/i.exec(ev.description ?? "")?.[1]?.trim();
  return { email: String(a.email).toLowerCase(), name: (a.displayName || fromTitle || String(a.email).split("@")[0]).trim(), phone: phone ?? null };
}

Deno.serve(async (req) => {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const debug = (await req.json().catch(() => ({})))?.debug === true;
  const { data: state } = await db.from("google_sync").select("*").eq("id", 1).maybeSingle();
  const firstRun = !state?.last_sync_at;
  const startedAt = new Date().toISOString();
  const feed = state?.ical_url as string | null;
  // deno-lint-ignore no-explicit-any
  let events: any[] = [];

  if (feed) {
    const res = await fetch(feed).catch(() => null);
    const body = res?.ok ? await res.text() : "";
    if (!body.startsWith("BEGIN:VCALENDAR")) return json({ error: `iCal feed unreadable (${res?.status ?? "network"})` }, 502);
    const from = Date.now() - 24 * 3_600_000;
    const to = Date.now() + 120 * 24 * 3_600_000;
    events = parseIcs(body, calendarIdOf()).filter((ev) => {
      const t = ev.start.dateTime ? new Date(ev.start.dateTime).getTime() : NaN;
      return !ev.recurring && t >= from && t <= to;
    });
  } else {
    const auth = await calendarAuth(db, null).catch(() => null);
    if (!auth) return json({ error: "Google Calendar not configured" }, 503);
    const params = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
      timeMin: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      timeMax: new Date(Date.now() + 120 * 24 * 3_600_000).toISOString(),
      ...(firstRun ? {} : { updatedMin: new Date(new Date(state.last_sync_at).getTime() - 10 * 60_000).toISOString() }),
    });
    for (let page: string | undefined, i = 0; i < 8; i++) {
      if (page) params.set("pageToken", page);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events?${params}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return json({ error: `Google ${res.status}: ${await res.text()}` }, 502);
      const data = await res.json();
      events.push(...(data.items ?? []));
      page = data.nextPageToken;
      if (!page) break;
    }

    // Shared as "See only free/busy": events come back without titles or guests, so bookings can't be recognised.
    // Stop without moving the checkpoint; the first run with full access then links existing bookings silently.
    if (events.length && events.every((ev) => !ev.summary && !(ev.attendees ?? []).length)) {
      return json({ error: "Calendar shared as free/busy only — share it with the service account as \"Make changes to events\"" }, 409);
    }
  }

  // Debug: store the shape of the events (no names/emails) in google_sync.debug, readable only by staff in the DB.
  if (debug) {
    const shape = events.map((ev) => ({
      title: String(ev.summary ?? "").replace(/\(([^)]+)\)\s*$/, "(…)"),
      type: ev.eventType,
      status: ev.status,
      start: ev.start?.dateTime ?? ev.start?.date,
      attendees: (ev.attendees ?? []).length,
      ours: !!ev.extendedProperties?.private?.outreach,
      meet: !!ev.hangoutLink,
      creatorSelf: !!ev.creator?.self,
    }));
    await db.from("google_sync").update({ debug: shape }).eq("id", 1);
    return json({ ok: true, debug: shape.length });
  }

  const admins = await adminRecipients(db);
  const alert = (subject: string, head: string, rows: [string, string | null | undefined][], leadId?: string) =>
    sendEmail({
      to: admins,
      subject,
      html: layout(
        eyebrow("Google booking page") + title(escape(head)) + facts(rows) + (leadId ? actions(button(`${APP_URL()}/admin?lead=${leadId}`, "Open lead")) : ""),
        head,
      ),
    });

  const out = { seen: 0, booked: 0, moved: 0, cancelled: 0, linkedSilently: 0, skipped: 0 };
  // deno-lint-ignore no-explicit-any
  const cancel = async (known: any, name: string, email: string) => {
    await db.from("google_bookings").update({ status: "cancelled", updated_at: startedAt }).eq("event_id", known.event_id);
    if (known.consultation_id) {
      await db
        .from("consultations")
        .update({ call_status: "none", preferred_call_at: null, suggested_call_at: null, google_event_id: null, meeting_url: null })
        .eq("id", known.consultation_id)
        .eq("google_event_id", known.event_id);
    }
    if (!firstRun) await alert(`❌ Booking cancelled: ${name} — ${malta(known.start_at)}`, `${name} cancelled their booking`, [["Was", malta(known.start_at) + " (Malta)"], ["Email", email]], known.consultation_id);
    out.cancelled++;
  };
  for (const ev of events) {
    if (ev.extendedProperties?.private?.outreach) continue; // created by the app
    if (!String(ev.summary ?? "").toLowerCase().includes(BOOKING_TITLE())) continue;
    const booker = bookerOf(ev);
    if (!booker) continue;
    out.seen++;
    const { data: known } = await db.from("google_bookings").select("*").eq("event_id", ev.id).maybeSingle();

    if (ev.status === "cancelled") {
      if (known && known.status !== "cancelled") await cancel(known, booker.name, booker.email);
      continue;
    }

    const start = ev.start?.dateTime ? new Date(ev.start.dateTime).toISOString() : null;
    if (!start) continue;
    const sameTime = !!known?.start_at && new Date(known.start_at).getTime() === new Date(start).getTime();
    if (known && sameTime && known.status !== "cancelled") {
      out.skipped++;
      continue;
    }

    // Find the lead (latest application with this email) or create one from the booking.
    let { data: c } = await db.from("consultations").select("*").eq("email", booker.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!c) {
      const { data: created, error } = await db
        .from("consultations")
        .insert({
          full_name: booker.name,
          email: booker.email,
          whatsapp: booker.phone ?? "",
          status: "consultation_booked",
          tracking: { source: "google_booking", tz: ev.start?.timeZone || "Europe/Malta" },
        })
        .select("*")
        .single();
      if (error || !created) continue;
      c = created;
    }

    const moved = !!known && !sameTime && known.status !== "cancelled";
    const { data: row } = await db
      .from("consultations")
      .update({
        call_status: "confirmed",
        preferred_call_at: start,
        suggested_call_at: start,
        call_declined_at: null,
        reminder_24h_at: start && new Date(start).getTime() - Date.now() < 25 * 3_600_000 ? startedAt : null,
        reminder_1h_at: null,
        google_event_id: ev.id,
        meeting_url: ev.hangoutLink ?? c.meeting_url,
        booked_via: "google",
        call_confirm_token: c.call_confirm_token ?? crypto.randomUUID(),
        ...(["new", "no_show", "not_interested"].includes(c.status) ? { status: "consultation_booked" } : {}),
      })
      .eq("id", c.id)
      .select("*")
      .single();
    await db
      .from("google_bookings")
      .upsert({ event_id: ev.id, consultation_id: c.id, start_at: start, status: "booked", booker_email: booker.email, updated_at: startedAt });

    if (firstRun) {
      out.linkedSilently++;
      continue;
    }
    if (row) await sendWaitingEmail(row, { moved, via: "google" });
    await alert(
      moved ? `🔁 Booking moved: ${booker.name} — ${malta(start)}` : `📅 New booking via Google: ${booker.name} — ${malta(start)}`,
      moved ? `${booker.name} moved their booking` : `${booker.name} booked a call`,
      [
        ["When", `${malta(start)} (Malta)`],
        ["Email", booker.email],
        ["Phone", booker.phone],
        ["Google Meet", ev.hangoutLink],
      ],
      c.id,
    );
    moved ? out.moved++ : out.booked++;
  }

  // iCal feed: deleted events simply disappear, so an upcoming booking missing from the feed was cancelled.
  if (feed && events.length) {
    const ids = new Set(events.map((ev) => ev.id));
    const { data: open } = await db.from("google_bookings").select("*").eq("status", "booked").gt("start_at", startedAt);
    for (const known of open ?? []) if (!ids.has(known.event_id)) await cancel(known, known.booker_email ?? "Candidate", known.booker_email ?? "");
  }

  await db.from("google_sync").update({ last_sync_at: startedAt }).eq("id", 1);
  return json({ ok: true, firstRun, events: events.length, ...out });
});
