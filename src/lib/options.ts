import { currentLocale } from "./i18n";
import type { Status } from "./types";

export const STUDY_PATHS = [
  { value: "english", label: "English course" },
  { value: "higher_education", label: "Diploma, Bachelor's or Master's" },
];

export const ENGLISH_LEVELS = [
  { value: "below_b2", label: "Below B2" },
  { value: "b2_plus", label: "B2 or above" },
];

export const PROGRAMMES = [
  "Accountancy and Finance",
  "Business Administration",
  "Health & Social Care",
  "Information Technology",
  "Logistics",
  "Tourism and Hospitality",
];

export const START_OPTIONS = ["Within 3 months", "3–6 months", "6–12 months", "Not sure yet"];

// Short names accepted in pre-filled links, e.g. ?path=b2&course=IT
const PATH_ALIASES: Record<string, "english" | "higher_education"> = {
  english: "english", "below-b2": "english", below_b2: "english", a2: "english", b1: "english",
  b2: "higher_education", "b2-plus": "higher_education", b2plus: "higher_education", higher: "higher_education",
  degree: "higher_education", diploma: "higher_education", bachelor: "higher_education", master: "higher_education",
};

const COURSE_ALIASES: Record<string, string> = {
  accountancy: "Accountancy and Finance", accounting: "Accountancy and Finance", finance: "Accountancy and Finance",
  business: "Business Administration", mba: "Business Administration",
  health: "Health & Social Care", care: "Health & Social Care",
  it: "Information Technology", tech: "Information Technology", computing: "Information Technology",
  logistics: "Logistics",
  tourism: "Tourism and Hospitality", hospitality: "Tourism and Hospitality",
};

export function parsePathParam(v: string | null) {
  return v ? PATH_ALIASES[v.trim().toLowerCase()] : undefined;
}

export function parseCourseParam(v: string | null) {
  if (!v) return undefined;
  const key = v.trim().toLowerCase();
  return COURSE_ALIASES[key] ?? PROGRAMMES.find((p) => p.toLowerCase() === key);
}

// Lead score (CRM rules): start soon, B2+, requested a call, uploaded documents.
export function leadScore(c: { start_date: string | null; english_level: string | null; callRequested: boolean; documents: number }) {
  const parts: [string, number][] = [];
  if (c.start_date === START_OPTIONS[0]) parts.push(["Starts within 3 months", 20]);
  else if (c.start_date === START_OPTIONS[1]) parts.push(["Starts in 3–6 months", 10]);
  if (c.english_level === "b2_plus") parts.push(["B2 or above", 10]);
  if (c.callRequested) parts.push(["Requested a call", 15]);
  if (c.documents > 0) parts.push(["Uploaded documents", 20]);
  const score = parts.reduce((n, [, p]) => n + p, 0);
  const tier = score >= 35 ? "hot" : score >= 20 ? "warm" : "cold";
  return { score, tier, parts } as const;
}

// Real booking page, shared manually after the profile is reviewed.
export const BOOKING_LINK = "https://calendar.app.google/qTS8FRBH5BZdGgCx7";

export const CALL_MINUTES = 20;

export type CallStage = "none" | "requested" | "reviewed" | "suggested" | "confirmed" | "declined";

export const CALL_STAGE_LABELS: Record<CallStage, string> = {
  none: "No times requested",
  requested: "Requested — pending review",
  reviewed: "Profile reviewed",
  suggested: "Waiting for candidate",
  confirmed: "Confirmed",
  declined: "Not a fit / later",
};

export function callStage(c: {
  call_status: string;
  requested_call_times: string[];
  call_reviewed_at: string | null;
  call_declined_at: string | null;
  suggested_call_at?: string | null;
}): CallStage {
  if (c.call_declined_at) return "declined";
  if (c.call_status === "confirmed") return "confirmed";
  if (c.suggested_call_at) return "suggested";
  if (c.call_reviewed_at) return "reviewed";
  return c.requested_call_times.length ? "requested" : "none";
}

/** Suggested time sent more than 24h ago and still not confirmed (an automatic reminder has gone out). */
export const noReply24h = (c: { suggested_call_at?: string | null; call_suggested_at?: string | null; call_status: string }) =>
  !!c.suggested_call_at && c.call_status !== "confirmed" && !!c.call_suggested_at && Date.now() - new Date(c.call_suggested_at).getTime() > 24 * 3_600_000;

// Documents candidates upload before their call, per study path.
export interface DocumentType {
  key: string;
  label: string;
  hint: string;
  required: boolean;
}

const REQUIRED_DOCUMENTS: DocumentType[] = [
  { key: "cv", label: "Updated CV in English", hint: "Education and work experience, written in English", required: true },
  { key: "passport", label: "Passport copy", hint: "Clear copy of the photo page", required: true },
  { key: "course_certificates", label: "Certificates for your chosen course", hint: "Relevant academic or professional certificates", required: true },
  { key: "ielts", label: "IELTS evidence according to the course requirement", hint: "Upload English-language evidence only if your chosen course requires it", required: false },
  { key: "personal_statement", label: "300-word personal statement", hint: "Explain your reasons for choosing this course and studying in Malta", required: true },
];

export const DOCUMENT_TYPES: Record<string, DocumentType[]> = {
  english: REQUIRED_DOCUMENTS,
  higher_education: REQUIRED_DOCUMENTS,
};

export const documentTypesFor = (studyPath: string | null) => DOCUMENT_TYPES[studyPath ?? ""] ?? DOCUMENT_TYPES.english;

export const REVIEW_CHECKLIST = [
  { key: "english", label: "English level confirmed" },
  { key: "course", label: "Course fits the profile" },
  { key: "documents", label: "Documents uploaded" },
  { key: "start", label: "Start date is realistic" },
];

// Times candidates can request (Malta time). Requests are reviewed, not booked.
const CALL_HOURS = { tz: "Europe/Malta", weekdays: [1, 2, 3, 4, 5], from: 10, to: 17, stepMinutes: CALL_MINUTES, days: 21, minHoursAhead: 24 };

// UTC instant for a wall-clock time in CALL_HOURS.tz (Date.UTC handles day overflow).
function zonedTime(y: number, m: number, d: number, h: number, min: number) {
  const guess = Date.UTC(y, m, d, h, min);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CALL_HOURS.tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (shown - guess));
}

export function callTimes(now = new Date(), minHoursAhead = CALL_HOURS.minHoursAhead): Date[] {
  const today = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: CALL_HOURS.tz, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const [y, m, d] = [+today.year, +today.month - 1, +today.day];
  const earliest = now.getTime() + minHoursAhead * 3600_000;
  const out: Date[] = [];
  for (let i = 0; i <= CALL_HOURS.days; i++) {
    if (!CALL_HOURS.weekdays.includes(new Date(Date.UTC(y, m, d + i)).getUTCDay())) continue;
    for (let t = CALL_HOURS.from * 60; t < CALL_HOURS.to * 60; t += CALL_HOURS.stepMinutes) {
      const at = zonedTime(y, m, d + i, Math.floor(t / 60), t % 60);
      if (at.getTime() >= earliest) out.push(at);
    }
  }
  return out;
}

export const STATUSES: { value: Status; label: string }[] = [
  { value: "new", label: "New lead" },
  { value: "consultation_booked", label: "Consultation booked" },
  { value: "interviewed", label: "Interviewed" },
  { value: "no_show", label: "No-show" },
  { value: "not_interested", label: "No longer interested" },
];

export const statusLabel = (s: Status) => STATUSES.find((x) => x.value === s)?.label ?? s;

export const labelFor = (list: { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? v ?? "—";

export function formatSlot(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(currentLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(new Date(iso));
}

export const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, "") || "";

export const waLink = (number: string, text = "") =>
  `https://wa.me/${number.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
