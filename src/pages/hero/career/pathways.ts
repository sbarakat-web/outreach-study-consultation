import { HERO_PROGRAMMES } from "../study/programmes";

const PATHWAY_COPY = {
  business: { title: "Business and Management", note: "Strategy, leadership and international enterprise" },
  tourism: { title: "Tourism and Hospitality", note: "Guest experience, operations and destination management" },
  accountancy: { title: "Accounting and Finance", note: "Financial insight, reporting and responsible decision-making" },
  it: { title: "Information Technology", note: "Digital systems, data and technology-led problem solving" },
  health: { title: "Health and Social Care", note: "People-centred services, wellbeing and community support" },
} as const;

/** Only pathways backed by a programme already present in the site's academic data. */
export const CAREER_PATHWAYS = HERO_PROGRAMMES.flatMap((programme) => {
  const copy = PATHWAY_COPY[programme.key as keyof typeof PATHWAY_COPY];
  return copy ? [{ key: programme.key, ...copy }] : [];
});
