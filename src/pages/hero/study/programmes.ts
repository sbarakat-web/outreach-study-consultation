/**
 * Programmes shown on /hero, derived ONLY from the existing programme data used by the Online
 * Sessions (src/pages/sessions/data.ts) — nothing here is typed by hand, so fees, schools and
 * durations stay in sync. Intake dates are not in that data, so the page says they are confirmed
 * by the adviser and the school (the site's existing wording) instead of inventing dates.
 *
 * "Discover your programme" links open the existing apply form pre-filled (?path=&course=, see
 * parsePathParam / parseCourseParam in src/lib/options.ts).
 */
import { ENGLISH_PROVIDERS, PROGRAMMES, SCHOLARSHIPS, type Level, type Programme } from "../../sessions/data";

export interface HeroProgramme {
  key: string;
  name: string;
  levels: Level[];
  /** Up to 4 real programmes (course · school · duration · fees). */
  examples: { course: string; school: string; duration: string; fees: string; qualification: string }[];
  count: number;
  fromFee: string | null;
  feeNote: string;
  durations: string;
  qualifications: string[];
  schools: string[];
  scholarship: boolean;
  apply: string;
  campus: { src: string; alt: string };
}

const LEVEL_LABEL: Record<Level, string> = { diploma: "Diploma", bachelor: "Bachelor's", master: "Master's" };
export const levelLabel = (l: Level) => LEVEL_LABEL[l];

const parseFee = (fee: string) => {
  const m = fee.replace(/,/g, "").match(/€\s*([\d.]+)\s*(K)?/i);
  return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : 0;
};
const euro = (n: number) => `€${n.toLocaleString("en-GB")}`;
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

const CAMPUS: Record<string, { src: string; alt: string }> = {
  "EIE European Business School": { src: "/partners/eie-campus.jpg", alt: "Sea view from EIE European Business School, Malta" },
  "GBS Malta": { src: "/partners/gbs-campus.jpg", alt: "GBS Malta campus building" },
  "London School of Commerce Malta": { src: "/partners/lsc-campus.jpg", alt: "London School of Commerce Malta" },
  "English Path Language Schools": { src: "/partners/english-path-campus.jpg", alt: "English Path classroom in Malta" },
};

function fromProgrammes(key: string, name: string, items: Programme[], course: string, campusSchool?: string): HeroProgramme {
  const firstYear = items.map((p) => parseFee(p.fees[0] ?? "")).filter(Boolean);
  const schools = uniq(items.map((p) => p.school));
  const levels = uniq(items.map((p) => p.level));
  const years = uniq(items.map((p) => p.duration)).sort();
  return {
    key,
    name,
    levels: (["diploma", "bachelor", "master"] as Level[]).filter((l) => levels.includes(l)),
    examples: spread(items).slice(0, 4).map((p) => ({
      course: p.course,
      school: p.school,
      duration: p.duration,
      qualification: p.qualification,
      fees: p.fees.filter((f) => f && f !== "-").join(" · "),
    })),
    count: items.length,
    fromFee: firstYear.length ? euro(Math.min(...firstYear)) : null,
    feeNote: "first-year tuition",
    durations: years.length > 1 ? `${years[0]} – ${years[years.length - 1]}` : years[0] ?? "",
    qualifications: uniq(items.map((p) => p.qualification)),
    schools,
    scholarship: items.some((p) => (SCHOLARSHIPS[p.area]?.[p.level]?.length ?? 0) > 0),
    apply: `/?path=higher&course=${course}`,
    campus: CAMPUS[campusSchool ?? schools[0]] ?? CAMPUS["EIE European Business School"],
  };
}

/** One programme per level first (master → bachelor → diploma), then the rest, so examples show the range. */
function spread(items: Programme[]) {
  const firsts = (["master", "bachelor", "diploma"] as Level[]).map((l) => items.find((p) => p.level === l)).filter((p): p is Programme => !!p);
  return [...firsts, ...items.filter((p) => !firsts.includes(p))];
}

const isMba = (p: Programme) => /\bMBA\b/.test(p.course);
const area = (a: string) => PROGRAMMES.filter((p) => p.area === a);

function english(): HeroProgramme | null {
  const lsc = ENGLISH_PROVIDERS.find((p) => p.name === "London School of Commerce Malta");
  const ep = ENGLISH_PROVIDERS.find((p) => p.name === "English Path Language Schools");
  if (!lsc || !ep) return null;
  const general = lsc.rows[0];
  const classic = ep.rows[0];
  const examples = [
    { course: `${general[0]} (11 weeks)`, school: lsc.name, duration: "11 weeks – 12 months", qualification: general[5], fees: `${general[7]} · 12 months ${general[10]}` },
    { course: `${classic[0]} — ${classic[1]}`, school: ep.name, duration: "Per week", qualification: classic[5], fees: `${classic[7]} per week · from ${classic[10]} per week (36+ weeks)` },
  ];
  if (lsc.offer) examples.push({ course: lsc.offer.title, school: lsc.name, duration: "1 year", qualification: "B1 or above", fees: `${lsc.offer.now} (was ${lsc.offer.was})` });
  return {
    key: "english",
    name: "English Language",
    levels: [],
    examples,
    count: ENGLISH_PROVIDERS.reduce((n, p) => n + p.rows.length, 0),
    fromFee: classic[10],
    feeNote: "per week (36+ weeks)",
    durations: "Weekly courses up to 12 months",
    qualifications: ["General", "Academic", "Business English"],
    schools: [lsc.name, ep.name],
    scholarship: false,
    apply: "/?path=english",
    campus: CAMPUS["English Path Language Schools"],
  };
}

/** In the order requested for the page; areas without programmes are left out automatically. */
export const HERO_PROGRAMMES: HeroProgramme[] = [
  fromProgrammes("business", "Business Administration", area("business").filter((p) => !isMba(p)), "business"),
  fromProgrammes("tourism", "Tourism & Hospitality", area("tourism"), "tourism"),
  fromProgrammes("accountancy", "Accounting & Finance", area("accountancy"), "accounting"),
  fromProgrammes("it", "Information Technology", area("it"), "it", "GBS Malta"),
  fromProgrammes("health", "Health & Social Care", area("health"), "health"),
  english(),
  fromProgrammes("mba", "MBA", PROGRAMMES.filter(isMba), "mba", "GBS Malta"),
].filter((p): p is HeroProgramme => !!p && p.count > 0);
