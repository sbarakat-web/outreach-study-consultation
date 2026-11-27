import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);

export const JOURNEY_MEDIA = {
  desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
} as const;

export const JOURNEY_DESKTOP_MIN = 1024;

/** Viewport-height scroll distances used by both section pins and cross-scene motion. */
export const JOURNEY_PIN = {
  dream: 110,
  travel: 160,
  malta: 150,
  graduate: 140,
  career: 145,
} as const;

/** Pins are measured first, the shared overlay next, and global progress last. */
export const JOURNEY_REFRESH = {
  dream: 60,
  travel: 50,
  malta: 40,
  study: 30,
  graduate: 20,
  career: 10,
  overlay: -10,
  controller: -100,
} as const;

export const JOURNEY_SCRUB = { desktop: 0.8, mobile: 0.4, overlayDesktop: 1, overlayMobile: 0.5 } as const;
