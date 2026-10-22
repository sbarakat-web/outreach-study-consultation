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

// Lead score (CRM rules): start soon, B2+, booked a call, uploaded documents.
export function leadScore(c: { start_date: string | null; english_level: string | null; hasSlot: boolean; documents: number }) {
  const parts: [string, number][] = [];
  if (c.start_date === START_OPTIONS[0]) parts.push(["Starts within 3 months", 20]);
  else if (c.start_date === START_OPTIONS[1]) parts.push(["Starts in 3–6 months", 10]);
  if (c.english_level === "b2_plus") parts.push(["B2 or above", 10]);
  if (c.hasSlot) parts.push(["Booked a call", 15]);
  if (c.documents > 0) parts.push(["Uploaded documents", 20]);
  const score = parts.reduce((n, [, p]) => n + p, 0);
  const tier = score >= 35 ? "hot" : score >= 20 ? "warm" : "cold";
  return { score, tier, parts } as const;
}

export const STATUSES: { value: Status; label: string }[] = [
  { value: "new", label: "New lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "consultation_booked", label: "Consultation booked" },
  { value: "documents_requested", label: "Documents requested" },
  { value: "application_submitted", label: "Application submitted" },
  { value: "offer_received", label: "Offer received" },
  { value: "payment", label: "Payment / deposit" },
  { value: "visa_process", label: "Visa process" },
  { value: "enrolled", label: "Enrolled" },
  { value: "lost", label: "Lost / not qualified" },
];

export const statusLabel = (s: Status) => STATUSES.find((x) => x.value === s)?.label ?? s;

export const labelFor = (list: { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? v ?? "—";

export function formatSlot(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(undefined, {
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
