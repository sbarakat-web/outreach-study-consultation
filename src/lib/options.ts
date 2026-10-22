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
