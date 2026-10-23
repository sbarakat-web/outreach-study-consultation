// Campaign sending for the marketing builder: audiences, personalisation values, local-morning
// timing, preferences and the actual send (Resend, with List-Unsubscribe headers).
import { renderEmail, type Block, type MarketingSettings } from "./marketing-render.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
export const APP_URL = () => env("APP_URL") || "https://consultation.outreachstudy.eu";
const FN_URL = () => `${env("SUPABASE_URL")}/functions/v1`;
const MAIL_FROM = () => env("MAIL_FROM") || "Outreach Study <hello@consultation.outreachstudy.eu>";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface Segment {
  preset?: "all" | "no_call" | "docs_missing";
  statuses?: string[];
  country?: string;
  course?: string;
}

// Must match DOCUMENT_TYPES (required) in src/lib/options.ts
const REQUIRED: Record<string, string[]> = { english: ["passport"], higher_education: ["passport", "diploma", "transcripts"] };

export async function loadSettings(db: Db): Promise<MarketingSettings> {
  const { data } = await db.from("marketing_settings").select("*").eq("id", 1).maybeSingle();
  return {
    address: data?.address ?? "",
    instagram_url: data?.instagram_url ?? "",
    facebook_url: data?.facebook_url ?? "",
    tiktok_url: data?.tiktok_url ?? "",
    whatsapp: data?.whatsapp ?? "35699728213",
    why_text: data?.why_text ?? "You are receiving this email because you applied or asked about studying in Malta with Outreach.",
  };
}

/** Candidates matching the audience, minus unsubscribed addresses and those who opted out of the topic. */
export async function resolveSegment(db: Db, seg: Segment, topic: "news" | "deadlines") {
  const { data } = await db.from("consultations").select("*, documents(doc_type, review_status)").limit(5000);
  const { data: prefs } = await db.from("marketing_preferences").select("email, news, deadlines, unsubscribed_at");
  const blocked = new Set((prefs ?? []).filter((p: Row) => p.unsubscribed_at || p[topic] === false).map((p: Row) => p.email));
  const seen = new Set<string>();
  return ((data ?? []) as Row[]).filter((c) => {
    if (!c.email || blocked.has(c.email) || seen.has(c.email)) return false;
    if (seg.preset === "no_call" && !(c.status === "new" && c.call_status !== "confirmed")) return false;
    if (seg.preset === "docs_missing") {
      if (c.status !== "interviewed") return false;
      const have = new Set((c.documents ?? []).filter((d: Row) => d.review_status !== "rejected").map((d: Row) => d.doc_type));
      if ((REQUIRED[c.study_path] ?? REQUIRED.english).every((k) => have.has(k))) return false;
    }
    if (seg.statuses?.length && !seg.statuses.includes(c.status)) return false;
    if (seg.country?.trim() && !String(c.country ?? "").toLowerCase().includes(seg.country.trim().toLowerCase())) return false;
    if (seg.course?.trim() && !String(c.desired_course ?? "").toLowerCase().includes(seg.course.trim().toLowerCase())) return false;
    seen.add(c.email);
    return true;
  });
}

/** Personalisation values for one candidate. */
export async function varsFor(db: Db, c: Row | null, advisors = new Map<string, string>()) {
  if (!c) return {};
  const adv = c.call_suggested_by ?? c.assigned_to;
  if (adv && !advisors.has(adv)) {
    const { data } = await db.from("staff_profiles").select("display_name").eq("email", adv).maybeSingle();
    advisors.set(adv, data?.display_name ?? "");
  }
  return {
    name: String(c.full_name ?? "").split(/\s+/)[0],
    course: c.desired_course ?? "",
    country: c.country ?? "",
    advisor: adv ? advisors.get(adv) ?? "" : "",
    call_date: c.preferred_call_at
      ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: c.tracking?.tz || "Europe/Malta" }).format(new Date(c.preferred_call_at))
      : "",
    dashboard_link: `${APP_URL()}/dashboard`,
  };
}

/** Next 09:00 in the candidate's time zone at or after `base` (hour precision, DST-safe). */
export function localMorning(base: Date, tz: string) {
  const start = new Date(Math.ceil(base.getTime() / 3_600_000) * 3_600_000);
  for (let h = 0; h < 48; h++) {
    const t = new Date(start.getTime() + h * 3_600_000);
    try {
      const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz || "Europe/Malta" }).format(t));
      if (hour === 9) return t;
    } catch {
      return base;
    }
  }
  return base;
}

/** Preferences row for an address (created on first email); returns its token. */
export async function prefsToken(db: Db, email: string) {
  const { data } = await db.from("marketing_preferences").upsert({ email }, { onConflict: "email", ignoreDuplicates: false }).select("token").single();
  return data?.token as string;
}

export const prefsLinks = (token: string) => ({
  unsubscribe: `${FN_URL()}/marketing-track?p=${token}&action=unsubscribe`,
  preferences: `${APP_URL()}/email-preferences?t=${token}`,
});

export async function sendMail(to: string, subject: string, html: string, text: string, unsubscribe: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM(),
      to,
      reply_to: "study@outreachrecruitment.net",
      subject,
      html,
      text,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, id: body.id ?? null, error: body.message ?? (res.ok ? null : `Email provider returned ${res.status}`) };
}

/** Render one template for one recipient (tracking links when a send token is given). */
export function renderFor(
  template: Row,
  subject: string,
  settings: MarketingSettings,
  vars: Record<string, string>,
  prefToken: string,
  sendToken?: string,
  openUrl?: string,
) {
  const links = prefsLinks(prefToken);
  // Campaign sends: unsubscribes are attributed to the campaign too.
  if (sendToken) links.unsubscribe += `&s=${sendToken}`;
  const track = sendToken ? `${FN_URL()}/marketing-track?s=${sendToken}` : null;
  const { html, text } = renderEmail({
    blocks: (template.blocks ?? []) as Block[],
    preheader: template.preheader,
    settings,
    vars,
    appUrl: APP_URL(),
    links: {
      ...links,
      open: track ? `${track}&action=open` : openUrl,
      wrap: track ? (u: string) => `${track}&action=click&u=${encodeURIComponent(u)}` : undefined,
    },
  });
  const filled = subject.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_w, k: string, fb?: string) => (vars[k]?.trim() ? vars[k] : fb ?? (k === "name" ? "there" : "")));
  return { html, text, subject: filled, unsubscribe: links.unsubscribe };
}

/** Send campaign emails that are due (claimed first, so overlapping runs never double-send). */
export async function processDueSends(db: Db, limit = 200) {
  const { data: due } = await db.from("marketing_sends").select("id").eq("status", "pending").lte("send_after", new Date().toISOString()).limit(limit);
  if (!due?.length) return 0;
  const settings = await loadSettings(db);
  const templates = new Map<string, Row>();
  const campaigns = new Map<string, Row>();
  const advisors = new Map<string, string>();
  let sent = 0;
  for (const { id } of due) {
    const { data: s } = await db.from("marketing_sends").update({ status: "sending" }).eq("id", id).eq("status", "pending").select("*").maybeSingle();
    if (!s) continue;
    if (!campaigns.has(s.campaign_id)) {
      const { data } = await db.from("marketing_campaigns").select("*").eq("id", s.campaign_id).maybeSingle();
      campaigns.set(s.campaign_id, data);
    }
    const camp = campaigns.get(s.campaign_id);
    if (!camp || camp.status === "cancelled") {
      await db.from("marketing_sends").update({ status: "cancelled" }).eq("id", id);
      continue;
    }
    if (!templates.has(camp.template_id)) {
      const { data } = await db.from("marketing_email_templates").select("*").eq("id", camp.template_id).maybeSingle();
      templates.set(camp.template_id, data);
    }
    const template = templates.get(camp.template_id);
    const { data: pref } = await db.from("marketing_preferences").select("*").eq("email", s.email).maybeSingle();
    if (!template || pref?.unsubscribed_at || pref?.[camp.topic] === false) {
      await db.from("marketing_sends").update({ status: "skipped", error: template ? "Unsubscribed or opted out" : "Template deleted" }).eq("id", id);
      continue;
    }
    const { data: c } = s.consultation_id ? await db.from("consultations").select("*").eq("id", s.consultation_id).maybeSingle() : { data: null };
    const vars = await varsFor(db, c, advisors);
    const token = pref?.token ?? (await prefsToken(db, s.email));
    const mail = renderFor(template, s.variant === "b" && camp.subject_b ? camp.subject_b : camp.subject_a, settings, vars as Record<string, string>, token, s.token);
    const r = await sendMail(s.email, mail.subject, mail.html, mail.text, mail.unsubscribe);
    await db.from("marketing_sends").update(r.ok ? { status: "sent", sent_at: new Date().toISOString(), error: null } : { status: "failed", error: r.error }).eq("id", id);
    if (r.ok) sent++;
  }
  // Campaigns with nothing left pending are done.
  for (const camp of campaigns.values()) {
    if (!camp || camp.status === "cancelled") continue;
    const { count } = await db.from("marketing_sends").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id).in("status", ["pending", "sending"]);
    if (!count) await db.from("marketing_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", camp.id).neq("status", "sent");
  }
  return sent;
}
