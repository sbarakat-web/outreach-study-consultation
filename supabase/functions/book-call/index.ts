// The candidate requests (or changes) their call time from the dashboard calendar.
//   POST { consultationId, at }   signed-in owner of the application
// The time must be a real call slot that is still free (other calls and requests + Google Calendar). It is held as
// "Awaiting confirmation": the candidate gets "request received", the admins an alert with the steps to confirm.
//   POST { consultationId, attend: true }   the candidate confirms they'll attend their confirmed call
//   POST { consultationId, enrol: {...} }   Study English Online enrolment request from the Programme page: kept in
//                                          tracking.online_enrolment; the team gets the details, the candidate a receipt
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { isCallSlot, isSlotFree } from "../_shared/slots.ts";
import { requestCall } from "../_shared/booked.ts";
import { actions, button, eyebrow, facts, layout, para, title, escape } from "../_shared/email.ts";
import { APP_URL, firstName, sendEmail } from "../_shared/call.ts";
import { adminRecipients } from "../_shared/admins.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: "Not signed in" }, 401);

  const { consultationId, at, attend, enrol } = await req.json().catch(() => ({}));
  const { data: c } = await db.from("consultations").select("*").eq("id", consultationId).maybeSingle();
  const owns = c && (c.user_id === user.id || (user.email_confirmed_at && c.email === user.email?.toLowerCase()));
  if (!owns) return json({ error: "not-allowed" }, 403);
  if (enrol && typeof enrol === "object") {
    const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100 ? Math.round(v) : undefined);
    const e = {
      full_name: c.full_name,
      email: c.email,
      date_of_birth: str(enrol.date_of_birth, 10),
      phone: str(enrol.phone, 40),
      nationality: str(enrol.nationality, 80),
      programme: str(enrol.programme, 120),
      class: str(enrol.class, 160) || undefined,
      weeks: num(enrol.weeks),
      extra_weeks: num(enrol.extra_weeks),
      lessons: num(enrol.lessons),
      start_week: str(enrol.start_week, 10),
      estimate: str(enrol.estimate, 40) || undefined,
      submitted_at: new Date().toISOString(),
    };
    if (!e.programme || !e.start_week || !e.date_of_birth) return json({ error: "Please fill in the programme, start week and date of birth." }, 400);
    const { error } = await db
      .from("consultations")
      .update({ tracking: { ...(c.tracking ?? {}), online_enrolment: JSON.stringify(e), online_enrolment_at: e.submitted_at } })
      .eq("id", c.id);
    if (error) return json({ error: error.message }, 500);
    const rows: [string, string | null | undefined][] = [
      ["Programme", e.programme],
      ["Class", e.class],
      ["Weeks", e.weeks ? `${e.weeks}${e.extra_weeks ? ` + ${e.extra_weeks} extra (offer)` : ""}` : null],
      ["Lessons", e.lessons ? String(e.lessons) : null],
      ["Start week", e.start_week],
      ["Estimated total", e.estimate ?? "To confirm"],
    ];
    await sendEmail({
      to: await adminRecipients(db),
      subject: `🎓 Online English enrolment: ${c.full_name} — ${e.programme}`,
      html: layout(
        eyebrow("Study English Online") +
          title(`${escape(c.full_name)} wants to enrol`) +
          facts([...rows, ["Email", c.email], ["Phone", e.phone], ["Date of birth", e.date_of_birth], ["Nationality", e.nationality]]) +
          para("Confirm the place with the school and send the invoice.", true) +
          actions(button(`${APP_URL()}/admin?lead=${c.id}`, "Open lead")),
        `${c.full_name}: ${e.programme}`,
      ),
    });
    await sendEmail({
      to: c.email,
      subject: `${firstName(c)}, we received your enrolment request — ${e.programme}`,
      html: layout(
        eyebrow("Enrolment request received") +
          title(`Thank you, ${escape(firstName(c))}!`) +
          para("We've received your request to join an online English programme. Your adviser will confirm your place and send you the invoice.", true) +
          facts(rows) +
          actions(button(`${APP_URL()}/dashboard/programme`, "View my programme")) +
          para(`Questions? <a href="https://wa.me/35699728213" style="color:#442DFA;font-weight:bold">WhatsApp +356 9972 8213</a>`, true),
        "Your enrolment request was received",
      ),
    });
    return json({ ok: true });
  }
  if (attend === true) {
    if (c.call_status !== "confirmed") return json({ error: "not-confirmed" }, 409);
    const confirmedAt = c.attendance_confirmed_at ?? new Date().toISOString();
    if (!c.attendance_confirmed_at) await db.from("consultations").update({ attendance_confirmed_at: confirmedAt }).eq("id", c.id);
    return json({ ok: true, attendanceConfirmedAt: confirmedAt });
  }
  if (typeof at !== "string" || !isCallSlot(at)) return json({ error: "invalid-time" }, 400);
  // A confirmed call can be changed here until 12h before it starts.
  if (c.call_status === "confirmed" && c.preferred_call_at && new Date(c.preferred_call_at).getTime() < Date.now() + 12 * 3_600_000) {
    return json({ error: "too-late" }, 409);
  }
  if (!(await isSlotFree(db, at, c.id))) return json({ error: "taken" }, 409);

  const r = await requestCall(db, c, new Date(at).toISOString(), "dashboard");
  if ("error" in r && r.error) return json({ error: r.error }, 500);
  return json({ ok: true, at: new Date(at).toISOString(), pending: true });
});
