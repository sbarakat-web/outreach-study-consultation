/**
 * Qualification facts for the Graduation scene, derived from the existing programme data
 * (src/pages/sessions/data.ts) — no hand-typed claims. Recognition details, employment and
 * immigration outcomes are NOT stated; the page says qualifications are confirmed by each school.
 */
import { PROGRAMMES, type Level } from "../../sessions/data";

const LEVEL_LABEL: Record<Level, string> = { diploma: "Diploma", bachelor: "Bachelor's", master: "Master's" };

const levels = (["diploma", "bachelor", "master"] as Level[]).filter((l) => PROGRAMMES.some((p) => p.level === l));

/** "MQF 5" → framework "MQF", level 5 (also "FHEQ Level 6", "OTHM 4"). */
const frameworks = new Map<string, number[]>();
for (const p of PROGRAMMES) {
  const m = p.qualification.match(/^([A-Z]+)\s*(?:Level\s*)?(\d+)/i);
  if (!m) continue;
  const list = frameworks.get(m[1]) ?? [];
  list.push(Number(m[2]));
  frameworks.set(m[1], list);
}
const range = (xs: number[]) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? `Level ${lo}` : `Levels ${lo}–${hi}`;
};

export const QUALIFICATION_LEVELS = levels.map((l) => LEVEL_LABEL[l]);
/** e.g. ["MQF Levels 5–7", "OTHM Levels 4–7", "FHEQ Levels 6–7"], most common framework first. */
export const QUALIFICATION_FRAMEWORKS = [...frameworks.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([fw, xs]) => `${fw} ${range(xs)}`);
export const PARTNER_SCHOOLS = [...new Set(PROGRAMMES.map((p) => p.school))];
