// Google Calendar access for the edge functions. Two ways to connect:
//   1. Service account (preferred, no login): secrets GOOGLE_SERVICE_ACCOUNT (the JSON key) and
//      GOOGLE_CALENDAR_ID (the calendar shared with the service account, e.g. your email).
//      Optional GOOGLE_IMPERSONATE (Workspace domain-wide delegation) → invites + Meet links work fully.
//   2. OAuth "Connect Google Calendar" per adviser: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET + google_connections rows.
const env = (k: string) => Deno.env.get(k) ?? "";
const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
export const CALL_MINUTES = 20;
// Calendar the service account writes to (shared with it in Google Calendar); GOOGLE_CALENDAR_ID overrides.
const DEFAULT_CALENDAR = "sbarakat@outreachrecruitment.net";
export const calendarIdOf = () => env("GOOGLE_CALENDAR_ID") || DEFAULT_CALENDAR;
export const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";

export interface CalendarAuth {
  token: string;
  calendarId: string;
  email: string;
  /** Service account without domain-wide delegation: Google refuses attendees and Meet links. */
  limited: boolean;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function serviceAccount(): ServiceAccount | null {
  try {
    const sa = JSON.parse(env("GOOGLE_SERVICE_ACCOUNT") || "null");
    return sa?.client_email && sa?.private_key ? sa : null;
  } catch {
    return null;
  }
}

export const oauthConfigured = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
export const googleConfigured = () => !!serviceAccount() || oauthConfigured();

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === "string" ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

let cached: { token: string; exp: number } | null = null;

async function serviceToken(sa: ServiceAccount) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = { iss: sa.client_email, scope: SCOPES, aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  if (env("GOOGLE_IMPERSONATE")) claims.sub = env("GOOGLE_IMPERSONATE");
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Google service account: ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, exp: Date.now() + expires_in * 1000 };
  return access_token as string;
}

/** Token + calendar to use: the service account when set up, otherwise the adviser's (or default) OAuth connection. */
// deno-lint-ignore no-explicit-any
export async function calendarAuth(db: any, email?: string | null): Promise<CalendarAuth | null> {
  const sa = serviceAccount();
  if (sa) {
    const calendarId = env("GOOGLE_CALENDAR_ID") || DEFAULT_CALENDAR;
    return { token: await serviceToken(sa), calendarId, email: calendarId, limited: !env("GOOGLE_IMPERSONATE") };
  }
  if (!oauthConfigured()) return null;
  const { data: rows } = await db.from("google_connections").select("email, refresh_token, calendar_id, is_default");
  const conn = rows?.find((r: { email: string }) => r.email === email) ?? rows?.find((r: { is_default: boolean }) => r.is_default) ?? rows?.[0];
  if (!conn) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
  });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  return { token: access_token, calendarId: conn.calendar_id, email: conn.email, limited: false };
}

// deno-lint-ignore no-explicit-any
export async function freeBusy(db: any, email: string | null | undefined, from: string, to: string) {
  const auth = await calendarAuth(db, email);
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

/**
 * Create the call event (with a Meet link and the candidate invited when Google allows it) and save
 * google_event_id / meeting_url. A plain service account can't invite or add Meet: the event is then
 * created without them instead of failing.
 */
// deno-lint-ignore no-explicit-any
export async function createCallEvent(db: any, c: Record<string, any>, at: string, staffEmail?: string | null) {
  const auth = await calendarAuth(db, c.assigned_to ?? staffEmail);
  if (!auth) return { error: "No connected Google Calendar" };
  const start = new Date(at);
  const end = new Date(start.getTime() + CALL_MINUTES * 60_000);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`;
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
    reminders: { useDefault: true },
  };
  const post = (body: Record<string, unknown>, query: string) =>
    fetch(`${base}?${query}`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const full = { ...event, attendees: [{ email: c.email }], conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } };
  let res = await post(full, "conferenceDataVersion=1&sendUpdates=all");
  if (!res.ok && auth.limited) {
    // Without delegation: try Meet only, then the plain event.
    res = await post({ ...event, conferenceData: full.conferenceData }, "conferenceDataVersion=1");
    if (!res.ok) res = await post(event, "sendUpdates=none");
  }
  const created = await res.json();
  if (!res.ok) return { error: created.error?.message ?? "Google error" };
  const meetUrl: string | null = created.hangoutLink ?? created.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === "video")?.uri ?? null;
  await db
    .from("consultations")
    .update({ google_event_id: created.id, meeting_url: meetUrl ?? c.meeting_url, assigned_to: c.assigned_to ?? (auth.limited ? c.assigned_to : auth.email) })
    .eq("id", c.id);
  return { meetUrl, eventId: created.id as string, calendar: auth.email };
}

// deno-lint-ignore no-explicit-any
export async function moveCallEvent(db: any, c: Record<string, any>, at: string, staffEmail?: string | null) {
  if (!c.google_event_id) return { ok: true, skipped: "no event" };
  const auth = await calendarAuth(db, c.assigned_to ?? staffEmail);
  if (!auth) return { error: "No connected Google Calendar" };
  const start = new Date(at);
  const end = new Date(start.getTime() + CALL_MINUTES * 60_000);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${c.google_event_id}?sendUpdates=${auth.limited ? "none" : "all"}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
    },
  );
  return { ok: res.ok };
}
