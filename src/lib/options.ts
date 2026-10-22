import type { Status } from "./types";

export const STUDY_PATHS = [
  { value: "english", label: "English course", hint: "General, exam prep or business English" },
  { value: "higher_education", label: "Higher education", hint: "Diploma, bachelor's or master's" },
  { value: "work_and_study", label: "Study & work", hint: "Programmes with work options" },
  { value: "not_sure", label: "Not sure yet", hint: "We'll help you choose" },
];

export const ENGLISH_LEVELS = [
  { value: "beginner", label: "Beginner", hint: "A1–A2 · I know a few words and phrases" },
  { value: "intermediate", label: "Intermediate", hint: "B1–B2 · I can hold a simple conversation" },
  { value: "advanced", label: "Advanced", hint: "C1–C2 · I'm comfortable in most situations" },
  { value: "not_sure", label: "I don't know", hint: "We can test your level for free" },
];

export const START_DATES = ["Within 3 months", "3–6 months", "6–12 months", "Later than 12 months"];
export const BUDGETS = ["Under €3,000", "€3,000–€6,000", "€6,000–€10,000", "Over €10,000", "Not sure"];
export const VISA_OPTIONS = ["Yes, I need visa support", "No, I'm an EU citizen", "Not sure"];
export const CONTACT_TIMES = ["Morning (9–12)", "Afternoon (12–17)", "Evening (17–20)", "Any time"];

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
