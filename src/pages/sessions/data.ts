// Content for the Online Study Session (/onlinesessions). Fees and conditions come from
// the supplied programme documents and must be reconfirmed before enrolment.
import {
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Code2,
  CreditCard,
  FileText,
  Globe,
  Globe2,
  GraduationCap,
  HeartPulse,
  Languages,
  Plane,
  School,
  ShieldCheck,
  Stamp,
  Sun,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export const BRAND = "Outreach Recruitment Agency";
export const BOOKING_URL = "https://calendar.app.google/qTS8FRBH5BZdGgCx7";
export const WHATSAPP = "+356 9972 8213";
export const DASHBOARD_URL = "https://consultation.outreachstudy.eu/dashboard";

// Optional photos: drop files with these names into public/onlinesessions/ and they appear.
export const IMAGES = {
  heroDesktop: "/onlinesessions/online-session-hero-v2.webp",
  heroMobile: "/onlinesessions/online-session-hero-mobile-v2.webp",
  intro: "/onlinesessions/introduction-english-path-gbs.webp",
};

export const CHAPTERS = [
  { title: "Introduction", subtitle: "Meet Outreach Recruitment Agency and see how this guided Malta session will help you." },
  { title: "Discover Malta", subtitle: "Why could Malta be the right place for your future?" },
  { title: "Programmes", subtitle: "Choose a study area, then select a programme to reveal the key details." },
  {
    title: "Visa Application Process",
    subtitle: "Six clear actions from preparing your documents to receiving the visa decision. All important details are shown below.",
  },
  { title: "School Partners", subtitle: "We work with a growing network of schools and education providers across Malta." },
  {
    title: "Other Information to Know",
    subtitle: "The essential work, career, visa, payment, tax-credit and refund information—shown clearly in one place.",
  },
  { title: "Thank You", subtitle: "Your personal Malta study session is complete." },
];

export interface InfoCard {
  icon: LucideIcon;
  title: string;
  text: string;
  points?: string[];
  image?: string;
}

export const DISCOVER: InfoCard[] = [
  { icon: Languages, title: "English-speaking", text: "English is an official national language.", image: "/onlinesessions/discover-english-speaking.webp" },
  { icon: Globe, title: "Schengen country", text: "Malta is part of the Schengen Zone.", image: "/onlinesessions/discover-schengen.webp" },
  { icon: GraduationCap, title: "Quality education", text: "Study through a high-quality education system.", image: "/onlinesessions/discover-education.webp" },
  { icon: WalletCards, title: "Affordable living", text: "A comparatively affordable Mediterranean study destination.", image: "/onlinesessions/discover-living.webp" },
  { icon: Sun, title: "Mediterranean lifestyle", text: "Beautiful climate, coastline and scenery.", image: "/onlinesessions/discover-lifestyle.webp" },
  { icon: BriefcaseBusiness, title: "Professional future", text: "Diverse professional opportunities to explore.", image: "/onlinesessions/discover-career.webp" },
];

export const VISA_STEPS: InfoCard[] = [
  {
    icon: FileText,
    title: "Prepare & Upload Documents",
    text: "Start by preparing clear electronic copies of the documents requested for your chosen programme.",
    points: ["Passport copy", "Academic certificates and transcripts", "CV and English-language evidence when required", "Upload readable files through the portal provided to you"],
  },
  {
    icon: School,
    title: "School Application Review",
    text: "The school checks your documents and confirms whether you meet the programme requirements.",
    points: ["Document and eligibility review", "English-level check", "Additional documents or an interview may be requested", "The school confirms the application outcome"],
  },
  {
    icon: CreditCard,
    title: "Reserve Your Seat",
    text: "After approval, follow the school's instructions to reserve your place and receive the offer letter.",
    points: [
      "For the stated intake, the reservation payment is €275",
      "€250 application fee plus €25 bank charges",
      "This payment is non-refundable",
      "Offer letter processing is normally approximately 24 hours",
    ],
  },
  {
    icon: CheckCircle2,
    title: "Accept Offer & Pay Tuition",
    text: "Read the offer carefully, accept its conditions and complete the required tuition-fee payment.",
    points: ["Check the programme, intake and personal details", "Follow the payment schedule stated by the school", "Use the approved payment method", "Keep your payment receipt"],
  },
  {
    icon: Stamp,
    title: "Receive Letter of Acceptance",
    text: "After the required tuition payment is received, the school prepares the electronic Letter of Acceptance.",
    points: [
      "Payment must be received and verified",
      "Check that the information on the e-LOA is correct",
      "Processing is normally within 48 hours of receiving payment",
      "Keep the e-LOA for the visa application",
    ],
  },
  {
    icon: Plane,
    title: "Submit Visa Application",
    text: "Prepare the final visa file and submit it through the appropriate application centre for your country of residence.",
    points: [
      "Follow the latest official visa checklist",
      "Book the appropriate submission appointment",
      "Provide originals, copies and biometrics when required",
      "Wait for the official decision before confirming travel",
    ],
  },
];

export interface Partner {
  name: string;
  website: string;
  logo: string;
  campusImage: string;
  location: string;
  programmes: string[];
  accreditation: string;
}

const partnerLogo = (slug: string) => `/partners/${slug}.png`;

export const PARTNERS: Partner[] = [
  {
    name: "eie European Business School",
    website: "eieinstitute.com",
    logo: partnerLogo("eie"),
    campusImage: "/partners/eie-campus.jpg",
    location: "St Julian's, Malta",
    programmes: ["Business and management", "Accounting and finance", "Hospitality", "MBA pathways"],
    accreditation: "MFHEA-licensed Higher Education Institution · Licence 2005-TC-001 · MQF/EQF Levels 5–7",
  },
  {
    name: "GBS Malta",
    website: "gbs.edu.mt",
    logo: partnerLogo("gbs"),
    campusImage: "/partners/gbs-campus.jpg",
    location: "St Julian's, Malta",
    programmes: ["Business and management", "Computing and IT", "Public health", "Postgraduate study"],
    accreditation: "MFHEA-licensed Higher Education Institution · Licence 2022-010 · MQF-aligned programmes",
  },
  {
    name: "English Path Malta",
    website: "englishpath.com/destinations/europe/malta",
    logo: partnerLogo("english-path"),
    campusImage: "/partners/english-path-campus.jpg",
    location: "St Julian's, Malta",
    programmes: ["General English", "Business English", "IELTS preparation", "Professional certificates"],
    accreditation: "Malta campus accredited by the ELT Council",
  },
  {
    name: "London School of Commerce Malta",
    website: "lscmalta.edu.mt",
    logo: "/partners/lsc.svg",
    campusImage: "/partners/lsc-campus.jpg",
    location: "Floriana, Malta",
    programmes: ["Business and management", "Undergraduate study", "MBA pathways", "Postgraduate study"],
    accreditation: "MFHEA-licensed Higher Education Institution · Licence 2013-FHI-025",
  },
  {
    name: "Kensington English",
    website: "kensingtonenglish.co.uk",
    logo: partnerLogo("kensington"),
    campusImage: "/partners/kensington-campus.jpg",
    location: "London-based · live online delivery",
    programmes: ["General English", "IELTS preparation", "Business English", "One-to-one tuition"],
    accreditation: "Courses taught by CELTA-qualified teachers; confirm the recognition required for the student's pathway",
  },
  {
    name: "School of Business & Management Malta",
    website: "sbm.edu.mt",
    logo: "/partners/sbm.webp",
    campusImage: "/partners/sbm-campus.webp",
    location: "Gżira, Malta",
    programmes: ["International Foundation Year", "Business", "Information technology", "Health and social care"],
    accreditation: "MFHEA-licensed institution · Licence 2021-015 · confirm programme-specific accreditation before enrolment",
  },
];

export const SCHOOL_LOGOS: Record<string, string> = {
  "EIE European Business School": partnerLogo("eie"),
  "GBS Malta": partnerLogo("gbs"),
  "London School of Commerce Malta": "/partners/lsc.svg",
  "School of Business & Management Malta": "/partners/sbm.webp",
};

export const OTHER_INFO: { title: string; description: string; cards: InfoCard[] }[] = [
  {
    title: "Working and career",
    description: "Employment guidance during and after study",
    cards: [
      {
        icon: Clock3,
        title: "Part-time Work for Students",
        text: "Students can work up to 20 hours a week after obtaining a part-time licence from Jobsplus.",
        points: ["Maximum: 20 hours per week", "The licence can only be obtained after receiving the TRC card", "Application fee: €150", "Collection fee: €80"],
      },
      {
        icon: BriefcaseBusiness,
        title: "Career Support",
        text: "We help students find part-time jobs during their studies and support them in finding full-time jobs after graduation.",
        points: ["Part-time job-search support during studies", "Full-time career support after graduation"],
      },
      {
        icon: Stamp,
        title: "Work Permit",
        text: "At the end of their studies, students can apply for a work permit after receiving a job offer.",
        points: ["Complete the course", "Obtain the course completion certificate", "Receive a job offer", "Apply for the appropriate work permit"],
      },
      {
        icon: Plane,
        title: "Post Visa Extension",
        text: "After successful course completion, the visa can be extended for an additional nine months.",
        points: ["Available after successful course completion", "Additional period: nine months", "Time to explore job opportunities in Malta and Europe"],
      },
    ],
  },
  {
    title: "Payments and financial benefits",
    description: "Payment options, tax credits and refund conditions",
    cards: [
      {
        icon: CreditCard,
        title: "Flexible Payment Plan",
        text: "Tuition fees may be paid according to a payment plan agreed directly with the school.",
        points: [
          "Available plans depend on the institution and programme",
          "Review the instalment amounts and deadlines before accepting",
          "Follow the schedule in the official school documentation",
          "Keep proof of every payment",
        ],
      },
      {
        icon: Award,
        title: "Get Qualified Scheme",
        text: "After successful course completion, eligible students may recover up to 70% of registration and tuition expenses through tax credits.",
        points: [
          "Subject to individual eligibility",
          "Available after successful course completion",
          "May cover up to 70% of registration and tuition fees paid when starting the course",
          "Recovery is provided through tax credits",
        ],
      },
      {
        icon: WalletCards,
        title: "Refund Policy",
        text: "The refund outcome depends on the student visa decision and submission of the required refund documents.",
        points: [
          "Visa declined: full tuition-fee refund",
          "Submit the refund request form together with the visa-decline letter",
          "Refund amount stated in the policy: €7,500",
          "Visa granted: no refund under any circumstances",
        ],
      },
    ],
  },
  {
    title: "Visa guidance",
    description: "Support with preparing the student visa journey",
    cards: [
      {
        icon: ShieldCheck,
        title: "Student Visa Support",
        text: "Students receive guidance to understand and prepare the visa application process.",
        points: [
          "Receive the relevant visa checklist",
          "Prepare the required documents",
          "Book the appropriate visa-application appointment",
          "Submit the application and complete any required interview",
          "Follow official instructions until the passport decision",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------- programmes

export type Level = "diploma" | "bachelor" | "master";

export interface Programme {
  id: string;
  area: string;
  level: Level;
  school: string;
  course: string;
  qualification: string;
  duration: string;
  fees: string[]; // year 1, year 2, year 3
  credits?: string;
  totalFee?: string;
  english?: string;
  requirement?: string;
}

export interface Area {
  key: string;
  name: string;
  short: string;
  icon: LucideIcon;
}

export const AREAS: Area[] = [
  { key: "english", name: "English Language", short: "English", icon: Languages },
  { key: "accountancy", name: "Accountancy & Finance", short: "Accountancy", icon: CreditCard },
  { key: "business", name: "Business Administration", short: "Business", icon: BriefcaseBusiness },
  { key: "health", name: "Health & Social Care", short: "Health", icon: HeartPulse },
  { key: "it", name: "Information Technology", short: "IT", icon: Code2 },
  { key: "tourism", name: "Tourism & Hospitality", short: "Tourism", icon: Plane },
  { key: "logistics", name: "Logistics", short: "Logistics", icon: Globe2 },
];

const EIE = "EIE European Business School";
const SBM = "School of Business & Management Malta";
const GBS = "GBS Malta";
const LSC = "London School of Commerce Malta";

type Row = [school: string, course: string, qualification: string, duration: string, ...fees: string[]];

const RAW: Record<string, Partial<Record<Level, Row[]>>> = {
  accountancy: {
    diploma: [
      [EIE, "Undergraduate Higher Diploma in Accountancy and Finance", "MQF 5", "2 years", "€7.5K", "€6K"],
      [SBM, "Diploma in Accounting and Business", "OTHM 4", "1 year", "€5K", "-"],
      [SBM, "Diploma in Accounting and Business (Level 5)", "OTHM 5", "1 year", "€5K", "-"],
    ],
    bachelor: [[EIE, "BA in Accountancy & Finance", "MQF 6", "3 years", "€7.5K", "€6K", "€6K"]],
    master: [[EIE, "MBA in Accounting and Finance", "MQF 7", "2 years", "€7.5K", "€6K"]],
  },
  business: {
    bachelor: [
      [EIE, "BA Business Administration", "MQF 6", "3 years", "€7.5K", "€6K", "€6K"],
      [LSC, "Bachelors with Honours in Business Administration", "FHEQ Level 6", "3 years", "€14,950", "-", "-"],
    ],
    master: [
      [EIE, "MBA", "MQF 7", "2 years", "€7.5K", "€6K"],
      [GBS, "MBA", "MQF 7", "1 year", "€10K", "-"],
      [LSC, "MBA", "FHEQ Level 7", "1 year", "€6,950", "-"],
    ],
  },
  health: {
    diploma: [
      [EIE, "Diploma in Health & Social Care", "MQF 5", "2 years", "€7.5K", "€6K"],
      [SBM, "Extended Diploma in Health and Social Care Management", "OTHM 5", "2 years", "€5K", "€5K"],
    ],
    master: [[GBS, "Masters in Public Health", "MQF 7", "1 year", "€10K"]],
  },
  it: {
    diploma: [
      [EIE, "Diploma in Information Technology", "MQF 5", "2 years", "€7.5K", "€6K"],
      [GBS, "Award in Information Technology and Study Skills", "MQF 5", "1 year", "€5K", "-"],
      [SBM, "Diploma in Data Science", "OTHM 7", "1 year", "€6K", "-"],
      [SBM, "Diploma in Information Technology", "OTHM 4", "1 year", "€5K", "-"],
      [SBM, "Extended Diploma in Information Technology", "OTHM 5", "2 years", "€5K", "€5K"],
      [SBM, "Diploma in Information Technology", "OTHM 6", "1 year", "€6K", "-"],
    ],
    bachelor: [[GBS, "BSc(Hons) Computer Science and Information Technology", "MQF 6", "3 years", "€6K", "€6K", "€6K"]],
    master: [[GBS, "MSc Information Technology Management", "MQF 7", "1 year", "€10K"]],
  },
  tourism: {
    diploma: [
      [EIE, "Undergraduate Higher Diploma in Tourism & Hospitality Management", "MQF 5", "2 years", "€7.5K", "€6K"],
      [SBM, "Diploma in Tourism and Hospitality Management", "OTHM 7", "1 year", "€6K", "-"],
      [SBM, "Extended Diploma in Tourism and Hospitality Management", "OTHM 5", "2 years", "€5K", "€5K"],
    ],
    bachelor: [[EIE, "BA in Tourism and Hospitality Management", "MQF 6", "3 years", "€7.5K", "€6K", "€6K"]],
    master: [[EIE, "MBA in Tourism and Hospitality Management", "MQF 7", "2 years", "€7.5K", "€6K"]],
  },
  logistics: {
    diploma: [[SBM, "Extended Diploma in Logistics and Supply Chain Management", "OTHM 5", "2 years", "€5K", "€5K"]],
  },
};

// Extra detail records where the supplied documents give them.
const DETAILS: Record<string, Partial<Programme>> = {
  "business-master-1": { credits: "90 ECTS", totalFee: "€10,000 · scholarship €7,500", english: "IELTS 6.0", requirement: "Undergraduate Degree" },
  "it-bachelor-0": { credits: "120 ECTS", totalFee: "€18,000", english: "IELTS 5.5", requirement: "Diploma in IT or related studies" },
};

const parseFee = (fee: string) => {
  const m = fee.replace(/,/g, "").match(/€\s*([\d.]+)\s*(K)?/i);
  return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : 0;
};

export const totalOf = (fees: string[]) => {
  const sum = fees.reduce((n, f) => n + parseFee(f), 0);
  return sum ? `€${sum.toLocaleString("en-GB")}` : "Confirm with school";
};

export const PROGRAMMES: Programme[] = Object.entries(RAW).flatMap(([area, levels]) =>
  (["diploma", "bachelor", "master"] as Level[]).flatMap((level) =>
    (levels[level] ?? []).map(([school, course, qualification, duration, ...fees], i) => {
      const id = `${area}-${level}-${i}`;
      return { id, area, level, school, course, qualification, duration, fees, totalFee: totalOf(fees), ...DETAILS[id] };
    }),
  ),
);

export const LEVEL_STYLE: Record<Level, { label: string; color: string; border: string; selected: string; text: string }> = {
  diploma: { label: "Diploma programmes", color: "#4a20ff", border: "border-violet-200", selected: "bg-violet-50", text: "text-violet-700" },
  bachelor: { label: "Bachelor programmes", color: "#ed2525", border: "border-red-200", selected: "bg-red-50", text: "text-red-700" },
  master: { label: "Master programmes", color: "#2f8a49", border: "border-emerald-200", selected: "bg-emerald-50", text: "text-emerald-700" },
};

export const SCHOLARSHIPS: Record<string, Partial<Record<Level, string[]>>> = {
  business: {
    bachelor: ["London School of Commerce Malta: Country-specific scholarship available. Contact Outreach Recruitment for more information."],
    master: [
      "GBS Malta: 25% scholarship when the full amount is paid upfront, or 20% when 50% is paid upon application and 50% after visa approval.",
      "London School of Commerce Malta: €1,000 off for students from Ghana, Kenya, Uganda, Rwanda, Tunisia, Algeria, Morocco, Turkey, Kazakhstan, Uzbekistan, Tajikistan, Thailand, Laos, Vietnam, China, Japan and Russia. €2,000 off for South America.",
    ],
  },
  health: {
    master: ["GBS Malta: 25% scholarship when the full amount is paid upfront, or 20% when 50% is paid upon application and 50% after visa approval."],
  },
  it: {
    master: ["GBS Malta: 25% scholarship when the full amount is paid upfront, or 20% when 50% is paid upon application and 50% after visa approval."],
  },
};

/** Best match: case-insensitive, either name contains the other. */
export function findBestMatch(...prefs: (string | null | undefined)[]): Programme | undefined {
  for (const pref of prefs) {
    const p = pref?.trim().toLowerCase();
    if (!p) continue;
    const hit = PROGRAMMES.find((x) => {
      const name = x.course.toLowerCase();
      return name.includes(p) || p.includes(name);
    });
    if (hit) return hit;
    // Our application form stores the study area (e.g. "Business Administration"); match it too.
    const area = AREAS.find((a) => a.name.toLowerCase().replace("&", "and") === p.replace("&", "and") || a.name.toLowerCase() === p);
    if (area) return PROGRAMMES.find((x) => x.area === area.key);
  }
  return undefined;
}

// ---------------------------------------------------------------- English language providers

export interface Provider {
  eyebrow: string;
  name: string;
  pill: string;
  columns: string[];
  rows: string[][];
  notes: { tone: "amber" | "sky"; text: string }[];
  offer?: { title: string; was: string; now: string; detail: string; admission: string };
}

export const ENGLISH_PROVIDERS: Provider[] = [
  {
    eyebrow: "Malta",
    name: "London School of Commerce Malta",
    pill: "Programme prices",
    columns: ["Mode", "Course", "Lessons/week", "Hours/week", "Lesson length", "English level", "Class time", "11 weeks", "6 months", "9 months", "12 months"],
    rows: [
      ["General English", "General", "20", "15", "3 hours", "Any level", "On request", "€1,450", "€2,450", "€3,450", "€4,450"],
      ["Academic", "Academic", "20", "15", "3 hours", "B1", "On request", "€1,450", "€2,450", "€3,450", "€4,450"],
      ["Academic", "Business", "20", "15", "3 hours", "B1", "On request", "€2,000", "N/A", "N/A", "N/A"],
    ],
    notes: [{ tone: "amber", text: "11-week option: only for nationals who do not need a visa to enter the Schengen area." }],
    offer: {
      title: "Award in Professional English",
      was: "€4,950",
      now: "€3,950",
      detail: "1 year · B1 or above · MQF Level 4 · 48 ECTS",
      admission: "Admission: age 18+, English B1 or above, and completed secondary education.",
    },
  },
  {
    eyebrow: "Malta",
    name: "English Path Language Schools",
    pill: "Prices per week",
    columns: ["Mode", "Course", "Lessons/week", "Hours/week", "Lesson length", "English level", "Class time", "1-11 weeks", "12-23 weeks", "24-35 weeks", "36+ weeks"],
    rows: [
      ["General English", "Classic morning", "20", "15", "45 min", "Any level", "09:00-12:15", "€295", "€255", "€190", "€160"],
      ["General English", "Classic afternoon", "20", "15", "45 min", "Any level", "13:45-17:00", "€240", "€200", "€190", "€160"],
      ["General English", "Semi-intensive morning", "25", "20", "45 min", "Any level", "09:00-13:30", "€405", "€315", "€265", "€200"],
      ["General English", "Semi-intensive afternoon", "25", "20", "45 min", "Any level", "12:30-17:00", "€285", "€245", "€265", "€200"],
      ["General English", "Super intensive", "40", "30", "45 min", "Any level", "09:00-17:00", "€535", "N/A", "N/A", "N/A"],
      ["Personalized", "One-to-one", "1", "-", "60 min", "All levels", "On request", "€105", "€525", "€1,050", "€2,100"],
      ["Academic", "Business, Management & Leadership I", "20", "Approx. 15", "-", "B2", "09:00-12:15", "€700", "-", "-", "-"],
      ["Academic", "Business, Management & Leadership II", "20", "Approx. 15", "-", "B2", "09:00-12:15", "€700", "-", "-", "-"],
    ],
    notes: [{ tone: "sky", text: "Morning or afternoon placement is subject to availability for semi-intensive students." }],
  },
  {
    eyebrow: "Online options",
    name: "Kensington",
    pill: "Prices in GBP",
    columns: ["Course", "English level", "Duration", "Lessons/week", "Price"],
    rows: [
      ["General English", "Any level", "12 weeks", "2 hours", "£390"],
      ["General English", "Any level", "24 weeks", "2 hours", "£390"],
      ["Academic", "B1-C1", "12 weeks", "2 hours", "£390"],
      ["One to One", "Any level", "1-4 hours", "1-4 hours", "£65 per hour"],
      ["One to One", "Any level", "5-9 hours", "5-9 hours", "£65 per hour"],
      ["One to One", "Any level", "10+ hours", "10+ hours", "£65 per hour"],
      ["Fly me", "Any level", "12 weeks", "2 hours", "£590"],
      ["Fly me", "Any level", "24 weeks", "2 hours", "£990"],
      ["Kids - Global Explorers (ages 10-17)", "Any level", "4 weeks", "2 hours", "£190"],
      ["Kids - Global Explorers (ages 10-17)", "Any level", "8 weeks", "2 hours", "£290"],
    ],
    notes: [{ tone: "amber", text: "A £25 registration fee applies." }],
  },
];

export const RECAP_DOCUMENTS = [
  "Updated CV in Europass Format",
  "Passport Bio Page",
  "Certificates with transcripts",
  "IELTS Certification (if available)",
  "300-word personal statement",
];
