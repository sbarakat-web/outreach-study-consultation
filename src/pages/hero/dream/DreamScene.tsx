import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { DreamClouds } from "./DreamClouds";
import { JOURNEY_MEDIA, JOURNEY_PIN, JOURNEY_REFRESH, JOURNEY_SCRUB } from "../animation";


/** Photo (1600×839) and the airplane's position in it (fractions), used for the camera target + takeoff anchor. */
const PHOTO = { w: 1600, h: 839, plane: { x: 0.41, y: 0.65 } };
/**
 * Portrait crops of the same photo: phones (x 760–1360, the student fills the frame) and
 * portrait tablets (x 560–1360, student + airplane nose + tower). Media queries are shared
 * with the <picture> sources so the camera always aims at the photo that is actually shown.
 */
const CROPS = [
  { media: "(max-width: 767px)", src: "/hero/dream-mobile.webp", x: 760, w: 600 },
  { media: "(min-width: 768px) and (max-width: 1180px) and (orientation: portrait)", src: "/hero/dream-portrait.webp", x: 560, w: 800 },
];
/** 32px blurred preview, shown instantly while the photo loads. */
const LQIP = "data:image/webp;base64,UklGRtIAAABXRUJQVlA4IMYAAABwBQCdASogABEAPu1irFAppSQisBgIATAdiWIAsO8sE34EDCnxOQE2Wb24gowGicirvcjMAP6U8ZC+/pRISqeE7kOBQVi/XImX+Vh7o6SQDaDXveLl+x5xhqD1PTYHlEPnKYjdx2X/AliLKQuBcjFsLwgY1IfnVn3/wjAlS0MYehzf5VNHEETHdPVXDxwwt0y8t8mM0NbOkbth8v6vLNEbUGaZTpE3yA9AI4hqnAOEXmLTNC2O6ianhVgIydApzQCcsA/gAAA=";

const HEADLINE = [["Every", "Great"], ["Future", "Starts"], ["with", "a", "Dream."]];

/** Where a point of the photo lands inside a container with object-fit: cover (object-position 50% 50%). */
function coverPoint(cw: number, ch: number, iw: number, ih: number, px: number, py: number) {
  const s = Math.max(cw / iw, ch / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { x: (cw - dw) / 2 + px * dw, y: (ch - dh) / 2 + py * dh };
}

/**
 * Scene 1 — Dream. Full-screen airport hero.
 *
 * Layers (back → front): photo (intro zoom wrapper → scroll "camera") · sun glow · scrims ·
 * copy · scroll cue · clouds (back + front). Animations use GSAP matchMedia:
 *  - desktop/tablet (≥768px): short pin (+=110%), scrubbed camera push towards the airplane,
 *    layered parallax, clouds rise; ends on the "takeoff" label.
 *  - phones: no pin, native scrolling, light zoom + fades.
 *  - prefers-reduced-motion: everything static and visible.
 * Everything on scroll is scrubbed, so it reverses naturally when scrolling back up.
 *
 * Takeoff hand-off (Step 4): [data-anchor="takeoff"] sits on the airplane in the photo and follows
 * the camera; the scroll timeline ends at the "takeoff" label (ScrollTrigger id "dream").
 */
export function DreamScene({ total }: { total: number }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const cam = q(".dream-cam")[0] as HTMLElement;
      const anchor = q("[data-anchor='takeoff']")[0] as HTMLElement;

      // Aim the camera (transform-origin) and the takeoff anchor at the airplane for the current viewport.
      const aim = () => {
        const crop = CROPS.find((c) => window.matchMedia(c.media).matches);
        const iw = crop ? crop.w : PHOTO.w;
        const px = crop ? (PHOTO.plane.x * PHOTO.w - crop.x) / crop.w : PHOTO.plane.x;
        const p = coverPoint(el.clientWidth, el.clientHeight, iw, PHOTO.h, px, PHOTO.plane.y);
        cam.style.transformOrigin = `${p.x}px ${p.y}px`;
        anchor.style.left = `${p.x}px`;
        anchor.style.top = `${p.y}px`;
      };
      aim();
      ScrollTrigger.addEventListener("refreshInit", aim);

      const mm = gsap.matchMedia();
      mm.add(
        JOURNEY_MEDIA,
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean; mobile: boolean };

          // --- Entrance (time-based, plays once on load) ---
          gsap
            .timeline({ defaults: { ease: "power3.out" } })
            .from(".dream-bg", { autoAlpha: 0, duration: 1.4, ease: "power1.out" }, 0)
            .from(".dream-bg", { scale: desktop ? 1.14 : 1.06, duration: desktop ? 3 : 2, ease: "power2.out" }, 0)
            .from(".dream-eyebrow", { autoAlpha: 0, y: 16, duration: 0.7 }, 0.45)
            .from(".dream-word > span", { yPercent: 110, duration: desktop ? 1.1 : 0.8, stagger: 0.07 }, 0.55)
            .from(".dream-sub", { autoAlpha: 0, y: 24, duration: 0.8 }, desktop ? 1.25 : 1)
            .from(".dream-cta", { autoAlpha: 0, y: 24, duration: 0.8 }, desktop ? 1.4 : 1.1)
            .from(".dream-scroll", { autoAlpha: 0, duration: 0.8 }, desktop ? 1.9 : 1.5);

          // --- Scroll (scrubbed → reverses on the way up) ---
          if (desktop) {
            gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  id: "dream",
                  trigger: el,
                  start: "top top",
                  end: `+=${JOURNEY_PIN.dream}%`,
                  pin: true,
                  scrub: JOURNEY_SCRUB.desktop,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                  refreshPriority: JOURNEY_REFRESH.dream,
                },
              })
              .addLabel("start")
              // background: camera push towards the airplane (slowest layer)
              .to(cam, { scale: 1.42, yPercent: -3, duration: 1 }, "start")
              // midground: sun glow drifts and brightens
              .to(".dream-glow", { xPercent: 8, yPercent: -6, opacity: 1, duration: 1 }, "start")
              // the scrim lifts as we move into the photo
              .to(".dream-scrim", { opacity: 0.45, duration: 0.7 }, "start")
              // foreground copy leaves faster than the camera moves (parallax)
              .to(".dream-content", { yPercent: -28, autoAlpha: 0, duration: 0.5, ease: "power1.in" }, "start")
              .to(".dream-scroll", { autoAlpha: 0, duration: 0.12 }, "start")
              // clouds: back bank slower, front bank faster
              .fromTo(".dream-clouds", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.45)
              .fromTo(".dream-clouds-back", { yPercent: 70 }, { yPercent: 0, duration: 0.55 }, 0.45)
              .fromTo(".dream-clouds-front", { yPercent: 100 }, { yPercent: 0, duration: 0.5 }, 0.5)
              .addLabel("takeoff");
          } else {
            gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: { id: "dream", trigger: el, start: "top top", end: "bottom top", scrub: JOURNEY_SCRUB.mobile, refreshPriority: JOURNEY_REFRESH.dream },
              })
              .to(cam, { scale: 1.12, duration: 1 }, 0)
              .to(".dream-content", { y: -60, autoAlpha: 0, duration: 0.55 }, 0)
              .to(".dream-scroll", { autoAlpha: 0, duration: 0.1 }, 0)
              .fromTo(".dream-clouds", { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 0.6 }, 0.35)
              .addLabel("takeoff");
          }
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
    <section
      ref={root}
      id="dream"
      data-chapter="dream"
      aria-labelledby="dream-title"
      className="dream hero-scene relative isolate flex overflow-hidden bg-navy"
    >
      {/* Background: intro wrapper → scroll camera → photo */}
      <div className="dream-bg absolute inset-0 -z-10 will-change-transform">
        <div className="dream-cam absolute inset-0 will-change-transform">
          <picture>
            {CROPS.map((c) => (
              <source key={c.src} media={c.media} srcSet={c.src} type="image/webp" />
            ))}
            <source srcSet="/hero/dream-1024.webp 1024w, /hero/dream-1600.webp 1600w" sizes="100vw" type="image/webp" />
            <img
              src="/hero/dream-1600.webp"
              alt="Young international student with luggage in an airport terminal, looking at a passenger airplane through the window at sunrise"
              width={1600}
              height={839}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover"
              style={{ backgroundImage: `url(${LQIP})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
          </picture>
          <span data-anchor="takeoff" className="pointer-events-none absolute h-px w-px" aria-hidden />
        </div>
      </div>

      {/* Midground: warm sunrise glow (parallax layer) */}
      <div
        className="dream-glow pointer-events-none absolute -inset-[10%] -z-10 opacity-60 mix-blend-screen"
        style={{ background: "radial-gradient(circle at 18% 62%, rgba(255,190,110,.55), rgba(255,190,110,0) 38%)" }}
        aria-hidden
      />

      {/* Readability scrims + header fade */}
      <div className="dream-scrim pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-navy/80 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t from-navy to-transparent" aria-hidden />

      {/* Foreground copy */}
      <div className="dream-content hero-container hero-scene-pad relative z-10 flex w-full items-end md:items-center">
        <div className="max-w-[44rem] lg:max-w-[56rem]">
          <p className="dream-eyebrow text-xs font-bold uppercase tracking-[0.32em] text-white/75 sm:text-sm">
            <span className="text-white">01</span>
            <span className="mx-2 text-white/40">/ {String(total).padStart(2, "0")}</span>
            Dream
          </p>
          <h1 id="dream-title" className="dream-title mt-4 font-extrabold text-white">
            {HEADLINE.map((line, li) => (
              <span key={li} className="block">
                {line.map((w, wi) => (
                  <span key={wi} className="dream-word">
                    <span className={li === HEADLINE.length - 1 && wi === line.length - 1 ? "hero-accent" : undefined}>{w}</span>
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <p className="dream-sub mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg md:text-xl">
            Your journey to an international education and career begins in Malta.
          </p>
          <div className="dream-cta mt-8">
            <Link
              to="/"
              className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 text-base font-bold text-white shadow-xl shadow-brand/30 transition hover:bg-brand/90 sm:w-auto"
            >
              Start Your Journey
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#travel"
        className="dream-scroll absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/75 md:text-[11px]"
      >
        Scroll to explore
        <span className="relative block h-10 w-px overflow-hidden bg-white/25">
          <span className="dream-scroll-dot absolute inset-x-0 top-0 h-3 bg-white" />
        </span>
      </a>

      <DreamClouds />
    </section>
  );
}
