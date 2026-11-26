/**
 * The scroll journey, in order. One <section> per chapter; ids are used as #anchors
 * and as keys for the (future) scroll timeline. Copy here is placeholder only.
 */
export const CHAPTERS = [
  { id: "dream", label: "Dream" },
  { id: "travel", label: "Travel" },
  { id: "malta", label: "Malta" },
  { id: "study", label: "Study" },
  { id: "graduate", label: "Graduate" },
  { id: "career", label: "Career" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];
