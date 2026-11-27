import { useRef } from "react";
import { MapPin } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SoftClouds, type Blob } from "../CloudBank";
import { JOURNEY_MEDIA, JOURNEY_PIN, JOURNEY_REFRESH, JOURNEY_SCRUB } from "../animation";


const BACK_CLOUDS: Blob[] = [[-5, 30, 34, 50, 0.45], [24, 40, 30, 40, 0.35], [52, 28, 36, 52, 0.42], [82, 38, 30, 44, 0.38]];
const MID_CLOUDS: Blob[] = [[-8, 35, 40, 70, 0.75], [30, 50, 34, 60, 0.6], [62, 30, 44, 75, 0.8], [96, 45, 30, 60, 0.6]];
const HEADLINE = [["Big", "Dreams"], ["Have", "No", "Borders."]];

/**
 * Scene 2 — Travel. Above the clouds at sunrise; the airplane itself lives in the shared
 * JourneyOverlay (it takes off from the Dream photo and flies this scene's sky).
 *
 * Layers (back → front): sky gradient + sun · photo cloud sea · back clouds · mid clouds · copy ·
 * "Destination: Malta" label · (overlay: trail, airplane, front clouds).
 *  - desktop/tablet: pinned for 160% (ScrollTrigger id "travel" — the overlay's flight reads it),
 *    subtle camera drift and cloud layers at different speeds.
 *  - phones: no pin, light parallax only.
 *  - reduced motion: static scene with a static airplane.
 */
export function TravelScene({ index, total }: { index: number; total: number }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const mm = gsap.matchMedia();
      mm.add(
        JOURNEY_MEDIA,
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean };

          // Copy arrives while the scene scrolls in (both layouts).
          gsap
            .timeline({ scrollTrigger: { trigger: el, start: "top 75%", end: "top 15%", scrub: 0.6 } })
            .from(".travel-eyebrow", { autoAlpha: 0, y: 20, ease: "power2.out" }, 0)
            .from(".travel-word > span", { yPercent: 110, stagger: 0.08, ease: "power3.out" }, 0.05)
            .from(".travel-sub", { autoAlpha: 0, y: 24, ease: "power2.out" }, 0.35);

          if (desktop) {
            gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: { id: "travel", trigger: el, start: "top top", end: `+=${JOURNEY_PIN.travel}%`, pin: true, scrub: JOURNEY_SCRUB.desktop, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: JOURNEY_REFRESH.travel },
              })
              // camera: slow drift and settle
              .fromTo(".travel-cam", { scale: 1.1, yPercent: 2 }, { scale: 1, yPercent: -2, duration: 1 }, 0)
              .fromTo(".travel-sun", { xPercent: -6, opacity: 0.7 }, { xPercent: 6, opacity: 1, duration: 1 }, 0)
              // cloud layers at different speeds (back slow → mid faster; front clouds live in the overlay)
              .fromTo(".travel-sea", { yPercent: 0 }, { yPercent: -4, duration: 1 }, 0)
              .fromTo(".travel-clouds-back", { xPercent: 0 }, { xPercent: -10, duration: 1 }, 0)
              .fromTo(".travel-clouds-mid", { xPercent: 4 }, { xPercent: -22, duration: 1 }, 0)
              // copy steps back as the flight continues
              .to(".travel-content", { autoAlpha: 0, yPercent: -12, duration: 0.25 }, 0.62)
              // "Destination: Malta"
              .fromTo(".travel-dest", { autoAlpha: 0, y: 24, clipPath: "inset(0 100% 0 0 round 999px)" }, { autoAlpha: 1, y: 0, clipPath: "inset(0 0% 0 0 round 999px)", duration: 0.18, ease: "power2.out" }, 0.4)
              .to(".travel-scrim", { opacity: 0, duration: 0.25 }, 0.62)
              .to(".travel-fade-cloud", { opacity: 1, duration: 0.3 }, 0.7)
              .addLabel("towards-malta", 1);
          } else {
            gsap
              .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.4 } })
              .fromTo(".travel-cam", { scale: 1.06 }, { scale: 1, duration: 1 }, 0)
              .fromTo(".travel-clouds-mid", { xPercent: 0 }, { xPercent: -12, duration: 1 }, 0)
              .fromTo(".travel-dest", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.5);
          }
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="travel" data-chapter="travel" aria-labelledby="travel-title" className="travel hero-scene relative isolate flex overflow-hidden bg-navy">
      {/* Camera: everything behind the copy */}
      <div className="travel-cam absolute inset-0 -z-10 will-change-transform">
        <div className="travel-sky absolute inset-0" />
        <div
          className="travel-sun absolute -inset-[10%]"
          style={{ background: "radial-gradient(circle at 22% 62%, rgba(255,214,170,.75), rgba(255,214,170,0) 30%)" }}
        />
        {/* Photo cloud sea (real photography, below the horizon) */}
        <picture className="travel-sea absolute inset-x-0 bottom-0 block h-[52%] md:h-[50%]">
          <source media="(max-width: 767px)" srcSet="/hero/travel-clouds-mobile.webp" type="image/webp" />
          <img
            src="/hero/travel-clouds.webp"
            alt="Sea of clouds at sunrise seen from an airplane"
            width={1200}
            height={307}
            loading="lazy"
            decoding="async"
            className="travel-sea-img h-full w-full object-cover object-top"
          />
        </picture>
        <SoftClouds blobs={BACK_CLOUDS} tint="250,238,240" className="travel-clouds-back absolute -inset-x-[15%] bottom-[28%] h-[34%]" />
        <SoftClouds blobs={MID_CLOUDS} className="travel-clouds-mid absolute -inset-x-[20%] bottom-[-10%] h-[38%]" />
      </div>

      {/* Seamless joins: navy from the Dream scene above, navy into the next scene below. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30%] bg-gradient-to-b from-navy to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[22%] bg-gradient-to-t from-navy to-transparent md:hidden" aria-hidden />
      <div className="travel-scrim pointer-events-none absolute inset-0 -z-10" aria-hidden />
      {/* Desktop: at the end of the pin the bottom turns to cloud, matching the start of the Malta scene. */}
      <div className="travel-fade-cloud pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden h-[40%] bg-gradient-to-t from-[#f3eff6] via-[#f3eff6]/60 to-transparent opacity-0 md:block" aria-hidden />

      {/* Static airplane for reduced motion (the animated one lives in JourneyOverlay). */}
      <div className="travel-static-plane absolute right-[6%] top-[22%] hidden aspect-[1055/268] w-[min(52vw,640px)] bg-contain bg-center bg-no-repeat" aria-hidden />

      <div className="travel-content hero-container hero-scene-pad relative z-10 flex w-full items-end md:pb-[16vh]">
        <div className="max-w-[44rem] lg:max-w-[52rem]">
          <p className="travel-eyebrow text-xs font-bold uppercase tracking-[0.32em] text-white/80 sm:text-sm">
            <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-white/50">/ {String(total).padStart(2, "0")}</span>
            Travel
          </p>
          <h2 id="travel-title" className="travel-title mt-4 font-extrabold text-white">
            {HEADLINE.map((line, li) => (
              <span key={li} className="block">
                {line.map((w, wi) => (
                  <span key={wi} className="travel-word">
                    <span className={li === HEADLINE.length - 1 && wi === line.length - 1 ? "hero-accent" : undefined}>{w}</span>
                  </span>
                ))}
              </span>
            ))}
          </h2>
          <p className="travel-sub mt-5 max-w-md text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
            Take the first step towards your international future.
          </p>
        </div>
      </div>

      {/* Destination label — the hand-off towards the Malta scene */}
      <div className="travel-dest absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] end-4 z-10 sm:end-8 md:bottom-12 md:end-24">
        <div className="flex items-center gap-3 rounded-full border border-white/35 bg-navy/75 py-2 pe-5 ps-2 text-white shadow-lg backdrop-blur-md">
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-brand">
            <span className="travel-dest-ping absolute inset-0 rounded-full bg-brand" />
            <MapPin className="relative h-4 w-4" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">Destination</span>
            <span className="block text-base font-extrabold sm:text-lg">Malta</span>
          </span>
          <span className="ms-1 hidden text-xs font-semibold text-white/60 sm:inline">35.9° N · 14.5° E</span>
        </div>
      </div>
    </section>
  );
}
