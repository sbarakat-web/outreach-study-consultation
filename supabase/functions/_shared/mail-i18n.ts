// Candidate email texts (English only).
export type MailLang = "en";

export const LOCALES: Record<MailLang, string> = { en: "en-GB" };

const en = {
  yourTime: "your time",
  maltaTime: "Malta time",
  minutes: "{n} minutes",
  advisorLine: "Your call with {name}",
  advisorRole: "Your Outreach advisor",
  whoAdvisor: "{name} from Outreach",
  whoTeam: "Outreach",

  keptSubject: "{name}, your call time is available — please confirm",
  keptEyebrow: "Confirm your call",
  keptTitle: "Hi {name}, good news!",
  keptIntro: "The time you chose is available:",
  keptButton: "✅ Yes, confirm my call",
  keptOther: "Need another time?",

  movedSubject: "{name}, can we move your call to {when}?",
  movedEyebrow: "New time suggested",
  movedTitle: "Hi {name}, can we move your call?",
  movedIntro: "Thank you for choosing a time. Unfortunately {old} is no longer available, so we'd like to suggest:",
  movedButton: "✅ Yes, this new time works",
  movedOther: "Doesn't suit you?",

  chooseOther: "Choose another time",
  meetAfter: "Once you confirm, you'll receive your <strong>Google Meet link by email</strong>.",
  deadline: "Please confirm before <strong>{when}</strong> so we can keep this time for you.",
  nextTitle: "What happens next",
  step1: "Confirm",
  step2: "Get your Meet link by email",
  step3: "Join the call",

  reminderSubject: "Reminder: please confirm your call — {when}",
  reminderEyebrow: "Reminder",
  reminderTitle: "Hi {name}, just a quick reminder",
  reminderIntro: "We're still keeping this time for your free call. Please confirm it with one click:",

  waKept: "Hi {name}, this is {who} 👋 Good news: the time you chose for your free call is available: {when}. Please confirm here: {url} (or reply YES). Once you confirm, you'll receive your Google Meet link by email. Need another time? {booking}",
  waMoved: "Hi {name}, this is {who} 👋 Unfortunately {old} is no longer available. Can we move your free call to {when}? Please confirm here: {url} (or reply YES). Once you confirm, you'll receive your Google Meet link by email. Another time? {booking}",

  confirmedSubject: "Your free call is confirmed — {when}",
  confirmedEyebrow: "Call confirmed",
  confirmedTitle: "Hi {name}, see you soon!",
  joinMeet: "Join Google Meet",
  meetPending: "Your advisor will send you the Google Meet link before the call.",
  openDashboard: "Open my dashboard",
  prepareTitle: "Prepare for your call",
  prepareText: "Please upload your <strong>passport</strong> and your <strong>latest certificate</strong> before the call, so your advisor can review your profile.",
  uploadDocs: "Upload documents →",
  inviteAttached: "The calendar invite is attached. Need another time? Reply to this email or message us on WhatsApp.",
  waConfirmed: "Hi {name}, your free call with Outreach is confirmed for {when}. {meet} Please upload your passport and latest certificate before the call: {url}",
  waMeetJoin: "Join here: {url}",
  waMeetPending: "We'll send you the Google Meet link by email.",
  icsTitle: "Free call with Outreach",
  icsAttached: "The calendar invite is attached.",
  needOther: "Need another time?",
  changeTime: "Change my call time",
};
export type MailKey = keyof typeof en;

export const langOf = (_c?: unknown): MailLang => "en";

/** Translator; {vars} are inserted as given (escape them first when HTML). */
export const mailT = (_lang: MailLang) => (key: MailKey, vars: Record<string, string | number> = {}) => {
  let s: string = en[key];
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};
