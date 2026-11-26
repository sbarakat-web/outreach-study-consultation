import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SoftClouds, type Blob } from "../CloudBank";
import { coverPoint } from "../cover";
import { MaltaFlag } from "./MaltaFlag";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Aerial photo of Valletta & the Grand Harbour (2048×1089) and the arrival point (fractions of the full photo):
 * the tip of Valletta (Fort St Elmo) on landscape/tablet, so the airplane's descent keeps heading right;
 * central Valletta on phones, where the portrait crop is narrow.
 */
const PHOTO = { w: 2048, h: 1089, dest: { x: 0.795, y: 0.376 } };
/** Portrait crops (same media queries as the <picture> sources, so the marker always matches the photo shown). */
const CROPS = [
  { media: "(max-width: 767px)", src: "/hero/malta-mobile.webp", x: 1000, w: 612, dest: { x: 0.66, y: 0.39 } },
  { media: "(min-width: 768px) and (max-width: 1180px) and (orientation: portrait)", src: "/hero/malta-portrait.webp", x: 950, w: 800 },
];
const LQIP = "data:image/webp;base64,UklGRsAAAABXRUJQVlA4ILQAAABQBQCdASogABEAPu1irVAppSQisBgIATAdiWYAnTKDLPwkvDcE4pSjEbBz3x9VXO+//gAA/VBpGdpKDB+u/Xnuo2pa8neBvLyqt9KAhPQ8MhmSOsRLCMmwHl2Cj7NqvMunkg5jAyHAnphQm8XGgmKxeS8u82vJc2++4E0s8Ppxt+k+mjYKm8PsGPFq8apm4KMOh28d0coM/vBJRoElWEZxA5+BDcRAIqvcPuERiRBDKFDwgAA=";

const LEFT_CLOUDS: Blob[] = [[-20, -10, 80, 70, 1], [-25, 35, 85, 80, 1], [10, 15, 55, 60, 0.9], [-10, 70, 70, 50, 0.95]];
const RIGHT_CLOUDS: Blob[] = [[40, -15, 85, 75, 1], [45, 30, 80, 85, 1], [30, 60, 70, 60, 0.9], [60, 5, 50, 55, 0.95]];
const WISPS: Blob[] = [[-10, 55, 45, 35, 0.55], [55, 70, 50, 30, 0.45]];

const HEADLINE = [["A", "Small", "Island."], ["A", "World", "of", "Opportunities."]];
const WELCOME = "Malta".split("");

/**
 * Scene 3 — Malta. The airplane (shared JourneyOverlay) lands on Valletta while the clouds part.
 *
 * Layers (back → front): aerial photo in a camera wrapper (zoom origin = the arrival point, so the
 * marker never drifts) · scrims · cloud wisps · parting cloud banks + haze · "Welcome to Malta" ·
 * destination marker with the Malta flag · headline/subtitle · (overlay: airplane, trail → journey line).
 *  - desktop/tablet: pinned for 150% (ScrollTrigger id "malta" — the overlay's arrival phase reads it).
 *  - phones: no pin; light cloud fade, small zoom, vertical journey line.
 *  - reduced motion: static, everything visible, no clouds.
 * [data-anchor='malta'] gives the overlay the arrival point in viewport pixels.
 */
export function MaltaScene({ index, total }: { index: number; total: number }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const cam = el.querySelector<HTMLElement>(".malta-cam")!;
      const anchor = el.querySelector<HTMLElement>("[data-anchor='malta']")!;
      const marker = el.querySelector<HTMLElement>(".malta-marker-wrap")!;

      // Aim the camera and the marker at Valletta for the current viewport / photo crop.
      const aim = () => {
        const crop = CROPS.find((c) => window.matchMedia(c.media).matches);
        const iw = crop ? crop.w : PHOTO.w;
        const dest = (crop && "dest" in crop && crop.dest) || PHOTO.dest;
        const px = crop ? (dest.x * PHOTO.w - crop.x) / crop.w : dest.x;
        const p = coverPoint(el.clientWidth, el.clientHeight, iw, PHOTO.h, px, dest.y);
        cam.style.transformOrigin = `${p.x}px ${p.y}px`;
        for (const t of [anchor, marker]) {
          t.style.left = `${p.x}px`;
          t.style.top = `${p.y}px`;
        }
      };
      aim();
      ScrollTrigger.addEventListener("refreshInit", aim);

      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean };

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: desktop
              ? { id: "malta", trigger: el, start: "top top", end: "+=150%", pin: true, scrub: 0.8, anticipatePin: 1 }
              : { trigger: el, start: "top 85%", end: "bottom 20%", scrub: 0.4 },
          });

          // Aerial camera: from close above Valletta, pulling back to reveal the harbour.
          tl.fromTo(cam, { scale: desktop ? 1.35 : 1.15 }, { scale: 1, duration: 1, ease: "power1.out" }, 0)
            // clouds part: left and right banks slide apart, the haze lifts, wisps rush past (fastest layer)
            .fromTo(".malta-haze", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, 0)
            .fromTo(".malta-clouds-l", { xPercent: 0, autoAlpha: 1 }, { xPercent: desktop ? -80 : -70, autoAlpha: 0, duration: 0.45, ease: "power1.in" }, 0.02)
            .fromTo(".malta-clouds-r", { xPercent: 0, autoAlpha: 1 }, { xPercent: desktop ? 80 : 70, autoAlpha: 0, duration: 0.45, ease: "power1.in" }, 0.02)
            .fromTo(".malta-wisps", { yPercent: 20, autoAlpha: 0 }, { yPercent: -90, autoAlpha: 0.8, duration: 0.5 }, 0.15)
            .to(".malta-wisps", { autoAlpha: 0, duration: 0.15 }, 0.55)
            // "Welcome to Malta"
            .from(".malta-welcome-pre", { autoAlpha: 0, y: 20, letterSpacing: "0.8em", duration: 0.12, ease: "power2.out" }, 0.12)
            .from(".malta-welcome-char", { autoAlpha: 0, yPercent: 60, duration: 0.1, stagger: 0.025, ease: "power3.out" }, 0.16)
            .to(".malta-welcome", { autoAlpha: 0, y: -40, duration: 0.08, ease: "power1.in" }, desktop ? 0.4 : 0.4)
            // destination marker (lands where the airplane touches down)
            .from(".malta-marker", { autoAlpha: 0, scale: 0.3, duration: 0.1, ease: "back.out(2)" }, desktop ? 0.24 : 0.28)
            .from(".malta-marker-label", { autoAlpha: 0, x: -12, duration: 0.08, ease: "power2.out" }, desktop ? 0.3 : 0.32)
            // copy
            .to(".malta-scrim", { opacity: 1, duration: 0.15 }, 0.45)
            .from(".malta-eyebrow", { autoAlpha: 0, y: 16, duration: 0.08, ease: "power2.out" }, 0.5)
            .from(".malta-word > span", { yPercent: 110, duration: 0.12, stagger: 0.02, ease: "power3.out" }, 0.52)
            .from(".malta-sub", { autoAlpha: 0, y: 24, duration: 0.1, ease: "power2.out" }, 0.66);

          if (!desktop) {
            // phones: the journey line grows down towards the next scene
            tl.fromTo(".malta-line", { scaleY: 0 }, { scaleY: 1, duration: 0.25 }, 0.72);
          }
          tl.addLabel("towards-study", 1);
        },
      );

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", aim);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="malta" data-chapter="malta" aria-labelledby="malta-title" className="malta hero-scene relative isolate flex overflow-hidden bg-navy">
      {/* Camera → aerial photo */}
      <div className="malta-cam absolute inset-0 -z-10 will-change-transform">
        <picture>
          {CROPS.map((c) => (
            <source key={c.src} media={c.media} srcSet={c.src} type="image/webp" />
          ))}
          <source srcSet="/hero/malta-1280.webp 1280w, /hero/malta-1600.webp 1600w, /hero/malta-2048.webp 2048w" sizes="100vw" type="image/webp" />
          <img
            src="/hero/malta-1600.webp"
            alt="Aerial view of Valletta and the Grand Harbour, Malta, with cruise ships and the Mediterranean coastline"
            width={2048}
            height={1089}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            style={{ backgroundImage: `url(${LQIP})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        </picture>
      </div>

      {/* Readability: soft top/bottom + side scrim that strengthens when the copy arrives */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-navy/60 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[26%] bg-gradient-to-t from-navy to-transparent" aria-hidden />
      <div className="malta-scrim pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden />

      {/* Arrival point (read by JourneyOverlay) + destination marker */}
      <span data-anchor="malta" className="pointer-events-none absolute h-px w-px" aria-hidden />
      <div className="malta-marker-wrap pointer-events-none absolute z-10" aria-hidden>
        <div className="malta-marker relative -translate-x-1/2 -translate-y-full">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pe-3 ps-1.5 shadow-xl shadow-navy/30">
              <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full ring-2 ring-white">
                <MaltaFlag className="h-full w-auto scale-150" />
              </span>
              <span className="malta-marker-label whitespace-nowrap text-sm font-extrabold text-navy">Valletta, Malta</span>
            </div>
            <span className="h-5 w-0.5 bg-white" />
            <span className="relative grid h-3 w-3 place-items-center">
              <span className="malta-pulse absolute h-3 w-3 rounded-full bg-white" />
              <span className="h-3 w-3 rounded-full border-2 border-white bg-brand" />
            </span>
          </div>
        </div>
      </div>

      {/* Clouds: wisps (fastest), parting banks and haze (cover the island before arrival) */}
      <SoftClouds blobs={WISPS} className="malta-wisps pointer-events-none absolute inset-0 z-[5] opacity-0" />
      <div className="malta-haze pointer-events-none absolute inset-0 z-[6]" aria-hidden />
      <SoftClouds blobs={LEFT_CLOUDS} tint="243,239,246" className="malta-clouds-l pointer-events-none absolute -inset-y-[10%] -left-[10%] z-[7] w-[85%]" />
      <SoftClouds blobs={RIGHT_CLOUDS} tint="243,239,246" className="malta-clouds-r pointer-events-none absolute -inset-y-[10%] -right-[10%] z-[7] w-[85%]" />

      {/* "Welcome to Malta" */}
      <div className="malta-welcome pointer-events-none absolute inset-x-0 top-[24%] z-[8] text-center md:top-[20%]" aria-hidden>
        <p className="malta-welcome-pre text-xs font-bold uppercase tracking-[0.5em] text-white sm:text-sm">Welcome to</p>
        <p className="malta-welcome-word mt-2 font-extrabold text-white">
          {WELCOME.map((c, i) => (
            <span key={i} className="malta-welcome-char inline-block">
              {c}
            </span>
          ))}
        </p>
      </div>

      {/* Copy */}
      <div className="malta-content hero-container hero-scene-pad relative z-10 flex w-full items-end md:pb-[14vh]">
        <div className="max-w-[44rem] lg:max-w-[50rem]">
          <p className="malta-eyebrow text-xs font-bold uppercase tracking-[0.32em] text-white/80 sm:text-sm">
            <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-white/50">/ {String(total).padStart(2, "0")}</span>
            Malta
          </p>
          <h2 id="malta-title" className="malta-title mt-4 font-extrabold text-white">
            {HEADLINE.map((line, li) => (
              <span key={li} className="block">
                {line.map((w, wi) => (
                  <span key={wi} className="malta-word">
                    <span className={li === HEADLINE.length - 1 ? "hero-accent" : undefined}>{w}</span>
                  </span>
                ))}
              </span>
            ))}
          </h2>
          <p className="malta-sub mt-5 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
            Discover Malta, your destination for international education, new experiences and future opportunities.
          </p>
        </div>
      </div>

      {/* Phones: journey line growing down towards the next scene (desktop uses the overlay's line) */}
      <span className="malta-line pointer-events-none absolute bottom-0 left-1/2 z-10 h-[10%] w-0.5 origin-top bg-white/80 md:hidden" aria-hidden />
    </section>
  );
}
