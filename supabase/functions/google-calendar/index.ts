// Google Calendar for advisers: connect (OAuth), busy times, Meet events for confirmed calls.
//   GET  /google-calendar/callback        OAuth redirect target
//   POST { action: "auth-url" }           staff: URL to connect their Google account
//   POST { action: "status" }             staff: connected accounts
//   POST { action: "busy", from, to }     staff: busy intervals of the caller (or default) calendar
//   POST { action: "public-busy", from, to }  anyone: busy intervals only (no details), default calendar
//   POST { action: "create-event", consultationId, at }  staff: event + Meet link, invites candidate
//   POST { action: "move-event", consultationId, at }    staff: reschedule the Google event
//   POST { action: "disconnect" | "set-default" }        staff / admin
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; optional APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const CALL_MINUTES = 20;
const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";
const redirectUri = () => `${env("SUPABASE_URL")}/functions/v1/google-calendar/callback`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

async function staffEmail(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = await db().auth.getUser(jwt);
  const u = data?.user;
  if (!u?.email || !u.email_confirmed_at) return null;
  const email = u.email.toLowerCase();
  const [{ data: a }, { data: p }] = await Promise.all([
    db().from("admins").select("email").eq("email", email).maybeSingle(),
    db().from("session_presenters").select("email").eq("email", email).maybeSingle(),
  ]);
  return a || p ? { email, admin: !!a } : null;
}

async function accessToken(email?: string | null) {
  const { data: rows } = await db().from("google_connections").select("email, refresh_token, calendar_id, is_default");
  const conn = rows?.find((r) => r.email === email) ?? rows?.find((r) => r.is_default) ?? rows?.[0];
  if (!conn) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  return { token: access_token as string, calendarId: conn.calendar_id as string, email: conn.email as string };
}

async function defaultEmail() {
  const { data } = await db().from("google_connections").select("email").eq("is_default", true).maybeSingle();
  return data?.email ?? null;
}

async function freeBusy(email: string | null, from: string, to: string) {
  const auth = await accessToken(email);
  if (!auth) return null;
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: from, timeMax: to, items: [{ id: auth.calendarId }] }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { email: auth.email, busy: (data.calendars?.[auth.calendarId]?.busy ?? []) as { start: string; end: string }[] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const configured = !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));

  // OAuth redirect
  if (req.method === "GET" && url.pathname.endsWith("/callback")) {
    const back = (q: string) => Response.redirect(`${APP_URL()}/admin/calendar?google=${q}`, 302);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return back("error");
    const { data: st } = await db().from("oauth_states").select("email, created_at").eq("state", state).maybeSingle();
    await db().from("oauth_states").delete().eq("state", state);
    if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) return back("expired");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const tok = await res.json();
    if (!res.ok || !tok.refresh_token) return back("error");
    const hasDefault = !!(await defaultEmail());
    await db().from("google_connections").upsert({ email: st.email, refresh_token: tok.refresh_token, is_default: !hasDefault });
    return back("connected");
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (!configured) return json({ error: "google-not-configured" }, action === "public-busy" ? 200 : 503);

  if (action === "public-busy") {
    const fb = await freeBusy(await defaultEmail(), body.from, body.to);
    return json({ busy: fb?.busy ?? [] });
  }

  const staff = await staffEmail(req);
  if (!staff) return json({ error: "Staff only" }, 403);

  switch (action) {
    case "auth-url": {
      const state = crypto.randomUUID();
      await db().from("oauth_states").insert({ state, email: staff.email });
      const params = new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        login_hint: staff.email,
        state,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }
    case "status": {
      const { data } = await db().from("google_connections").select("email, is_default");
      return json({ connections: data ?? [] });
    }
    case "busy": {
      const fb = await freeBusy(body.email ?? staff.email, body.from, body.to);
      return json(fb ?? { busy: [], email: null });
    }
    case "disconnect": {
      await db().from("google_connections").delete().eq("email", staff.email);
      return json({ ok: true });
    }
    case "set-default": {
      if (!staff.admin) return json({ error: "Admins only" }, 403);
      await db().from("google_connections").update({ is_default: false }).neq("email", body.email);
      await db().from("google_connections").update({ is_default: true }).eq("email", body.email);
      return json({ ok: true });
    }
    case "create-event":
    case "move-event": {
      const { data: c } = await db().from("consultations").select("*").eq("id", body.consultationId).maybeSingle();
      if (!c) return json({ error: "Candidate not found" }, 404);
      const auth = await accessToken(c.assigned_to ?? staff.email);
      if (!auth) return json({ error: "No connected Google Calendar" }, 409);
      const start = new Date(body.at);
      const end = new Date(start.getTime() + CALL_MINUTES * 60_000);
      const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`;

      if (action === "move-event") {
        if (!c.google_event_id) return json({ ok: true, skipped: "no event" });
        const res = await fetch(`${base}/${c.google_event_id}?sendUpdates=all`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
        });
        return json({ ok: res.ok });
      }

      const event = {
        summary: `Outreach call — ${c.full_name}`,
        description: [
          `Candidate: ${c.full_name} (${c.email})`,
          c.whatsapp ? `WhatsApp: ${c.whatsapp}` : "",
          `Course: ${c.desired_course ?? "-"}`,
          `Lead: ${APP_URL()}/admin?lead=${c.id}`,
          `Online session: ${APP_URL()}/onlinesessions?present=1&candidate=${c.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: c.email }],
        conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: true },
      };
      const res = await fetch(`${base}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      const created = await res.json();
      if (!res.ok) return json({ error: created.error?.message ?? "Google error" }, 502);
      const meetUrl = created.hangoutLink ?? created.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === "video")?.uri ?? null;
      await db()
        .from("consultations")
        .update({ google_event_id: created.id, meeting_url: meetUrl ?? c.meeting_url, assigned_to: c.assigned_to ?? auth.email })
        .eq("id", c.id);
      return json({ ok: true, meetUrl, eventId: created.id, calendar: auth.email });
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
});
