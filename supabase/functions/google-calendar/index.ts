// Google Calendar for advisers: busy times and Meet events for confirmed calls.
// Connects through a service account (GOOGLE_SERVICE_ACCOUNT + GOOGLE_CALENDAR_ID, see _shared/google.ts)
// or per-adviser OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
//   GET  /google-calendar/callback        OAuth redirect target
//   POST { action: "auth-url" }           staff: URL to connect their Google account (OAuth only)
//   POST { action: "status" }             staff: connected accounts (+ service calendar)
//   POST { action: "busy", from, to }     staff: busy intervals of the caller (or default) calendar
//   POST { action: "public-busy", from, to }  anyone: busy intervals only (no details), default calendar
//   POST { action: "create-event", consultationId, at }  staff: event + Meet link, invites candidate
//   POST { action: "move-event", consultationId, at }    staff: reschedule the Google event
//   POST { action: "disconnect" | "set-default" }        staff / admin
// Secrets: GOOGLE_SERVICE_ACCOUNT, GOOGLE_CALENDAR_ID, optional GOOGLE_IMPERSONATE; or GOOGLE_CLIENT_ID/SECRET; optional APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { SCOPES, calendarIdOf, createCallEvent, freeBusy, googleConfigured, moveCallEvent, oauthConfigured, serviceAccount } from "../_shared/google.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
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

async function defaultEmail() {
  const { data } = await db().from("google_connections").select("email").eq("is_default", true).maybeSingle();
  return data?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

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

  if (!googleConfigured()) return json({ error: "google-not-configured" }, action === "public-busy" ? 200 : 503);

  if (action === "public-busy") {
    const fb = await freeBusy(db(), await defaultEmail(), body.from, body.to).catch(() => null);
    return json({ busy: fb?.busy ?? [] });
  }

  const staff = await staffEmail(req);
  if (!staff) return json({ error: "Staff only" }, 403);

  try {
    switch (action) {
      case "auth-url": {
        if (!oauthConfigured()) return json({ error: "Calendar is connected through the service account" }, 400);
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
        if (serviceAccount()) {
          // Check the shared calendar is actually reachable.
          const now = new Date();
          const fb = await freeBusy(db(), null, now.toISOString(), new Date(now.getTime() + 3_600_000).toISOString());
          return json({
            service: { calendar: calendarIdOf(), account: serviceAccount()!.client_email, ok: !!fb, delegated: !!env("GOOGLE_IMPERSONATE") },
            connections: fb ? [{ email: calendarIdOf(), is_default: true }] : [],
          });
        }
        const { data } = await db().from("google_connections").select("email, is_default");
        return json({ connections: data ?? [] });
      }
      case "busy": {
        const fb = await freeBusy(db(), body.email ?? staff.email, body.from, body.to);
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
        const r = action === "move-event" ? await moveCallEvent(db(), c, body.at, staff.email) : await createCallEvent(db(), c, body.at, staff.email);
        return "error" in r && r.error ? json(r, r.error === "No connected Google Calendar" ? 409 : 502) : json({ ok: true, ...r });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
