/**
 * The scroll journey, in order: one full-screen <Scene> per chapter.
 * Ids are #anchors and keys for the (future) scroll timeline / airplane path.
 *
 * Photos: `image` uses a real photo (desktop landscape + optional portrait crop/photo for phones).
 * `placeholder` marks a scene still waiting for photography — it renders a labelled stand-in
 * with the brief and the sizes to deliver. Put new photos in /public/hero/.
 */
export type Align = "start" | "end" | "center";

export interface ScenePhoto {
  /** Landscape photo (tablet + desktop). */
  desktop: string;
  /** Portrait-friendly photo for phones (falls back to `desktop`, cropped). */
  mobile?: string;
  /** CSS object-position for each, to keep the subject in frame. */
  posDesktop?: string;
  posMobile?: string;
  alt: string;
}

export interface Chapter {
  id: string;
  label: string;
  /** Headline lines; the last line is the accent line. */
  title: string[];
  text: string;
  align: Align;
  image?: ScenePhoto;
  placeholder?: { brief: string; tint: string };
  cta?: boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    id: "dream",
    label: "Dream",
    title: ["Every Great Future", "Starts with a Dream."],
    text: "It begins with a question: what if?",
    align: "start",
    placeholder: {
      brief: "Young student at a window at golden hour, looking out, thinking about the future",
      tint: "from-[#1d1a52] via-[#3a2a7a] to-[#c9704a]",
    },
  },
  {
    id: "travel",
    label: "Travel",
    title: ["Big Dreams", "Have No Borders."],
    text: "One flight can change the direction of your life.",
    align: "end",
    placeholder: {
      brief: "Aeroplane window or wing above the clouds, warm sunlight",
      tint: "from-[#14123a] via-[#2b4c8c] to-[#9cc3e8]",
    },
  },
  {
    id: "malta",
    label: "Malta",
    title: ["A Small Island.", "A World of Opportunities."],
    text: "English-speaking, European and 300 days of sunshine a year.",
    align: "start",
    image: {
      desktop: "/onlinesessions/discover-malta-real.webp",
      posDesktop: "50% 50%",
      posMobile: "38% 50%",
      alt: "Valletta skyline and a traditional Maltese luzzu boat at sunset",
    },
  },
  {
    id: "study",
    label: "Study",
    title: ["Learn Today.", "Lead Tomorrow."],
    text: "Accredited English and higher-education programmes at Malta's leading schools.",
    align: "end",
    image: {
      desktop: "/partners/kensington-campus.jpg",
      mobile: "/partners/gbs-campus.jpg",
      posDesktop: "50% 40%",
      posMobile: "50% 30%",
      alt: "Students working together on laptops",
    },
  },
  {
    id: "graduate",
    label: "Graduate",
    title: ["From Ambition", "to Achievement."],
    text: "The day the dream becomes a diploma.",
    align: "start",
    placeholder: {
      brief: "Graduates throwing caps in the air, Maltese limestone architecture behind",
      tint: "from-[#14123a] via-[#5a3fb0] to-[#e3b86b]",
    },
  },
  {
    id: "career",
    label: "Career",
    title: ["Your Journey Doesn't End Here.", "It Begins."],
    text: "Work while you study, build experience and open doors across Europe.",
    align: "end",
    placeholder: {
      brief: "Young professional in a bright modern office or on a rooftop with the city skyline",
      tint: "from-[#0f1030] via-[#24306e] to-[#6fa0d8]",
    },
  },
  {
    id: "apply",
    label: "Apply",
    title: ["Dream Big. Fly Further.", "Become More."],
    text: "Your free consultation takes two minutes to book.",
    align: "center",
    image: {
      desktop: "/partners/eie-campus.jpg",
      posDesktop: "50% 55%",
      posMobile: "45% 50%",
      alt: "Sea view over Sliema, Malta",
    },
    cta: true,
  },
];

export type ChapterId = (typeof CHAPTERS)[number]["id"];
