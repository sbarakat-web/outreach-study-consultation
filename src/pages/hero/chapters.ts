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
    // Rendered by dream/DreamScene.tsx (animated hero); kept here for the progress rail and order.
    id: "dream",
    label: "Dream",
    title: ["Every Great Future", "Starts with a Dream."],
    text: "Your journey to an international education and career begins in Malta.",
    align: "start",
    image: {
      desktop: "/hero/dream-1600.webp",
      mobile: "/hero/dream-mobile.webp",
      alt: "Young international student with luggage in an airport terminal, looking at a passenger airplane",
    },
  },
  {
    // Rendered by travel/TravelScene.tsx (airplane in JourneyOverlay); kept here for the progress rail and order.
    id: "travel",
    label: "Travel",
    title: ["Big Dreams", "Have No Borders."],
    text: "Take the first step towards your international future.",
    align: "start",
    image: {
      desktop: "/hero/travel-clouds.webp",
      mobile: "/hero/travel-clouds-mobile.webp",
      alt: "Sea of clouds at sunrise seen from an airplane",
    },
  },
  {
    // Rendered by malta/MaltaScene.tsx (arrival of the JourneyOverlay flight); kept here for the progress rail and order.
    id: "malta",
    label: "Malta",
    title: ["A Small Island.", "A World of Opportunities."],
    text: "Discover Malta, your destination for international education, new experiences and future opportunities.",
    align: "start",
    image: {
      desktop: "/hero/malta-1600.webp",
      mobile: "/hero/malta-mobile.webp",
      alt: "Aerial view of Valletta and the Grand Harbour, Malta",
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
