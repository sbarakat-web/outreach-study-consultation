import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";
import { SoftClouds, type Blob } from "./CloudBank";
import { FLIGHT_PHASES, PLANE_NOSE_DEG, desktopPath, mobilePath } from "./flight";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);

const FRONT_CLOUDS: Blob[] = [[0, 30, 34, 80, 0.85], [28, 50, 26, 60, 0.6], [62, 35, 38, 85, 0.85], [92, 55, 26, 55, 0.6]];

/**
 * Shared, fixed layer above every scene: the journey's flight path (dotted trail), the airplane and
 * the front cloud layer that passes in front of it. One system for the whole page — later scenes
 * extend this timeline instead of adding their own airplane.
 *
 * Must render AFTER <main> so its ScrollTriggers are created after the scenes' pins (correct order).
 * Hidden entirely for prefers-reduced-motion (the Travel scene shows a static airplane instead).
 * Add ?debug=overlay to the URL to outline the layers.
 */
export function JourneyOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const debug = new URLSearchParams(window.location.search).get("debug") === "overlay";
  const outline = debug ? "outline outline-1 outline-dashed outline-amber-300/60" : "";

  useGSAP(
    () => {
      const el = root.current!;
      const svg = el.querySelector<SVGSVGElement>("[data-layer='flight-path']")!;
      const guide = el.querySelector<SVGPathElement>(".trail-guide")!;
      const dots = el.querySelector<SVGPathElement>(".trail-dots")!;
      const reveal = el.querySelector<SVGPathElement>(".trail-reveal")!;
      const mask = el.querySelector<SVGMaskElement>("#trail-mask")!;
      const plane = el.querySelector<HTMLElement>(".journey-plane")!;
      const travel = document.getElementById("travel");
      if (!travel) return;

      let len = 0;
      // (Re)build the path for the current viewport; runs before every refresh.
      const build = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const mobile = w < 768;
        const a = document.querySelector<HTMLElement>("[data-anchor='takeoff']");
        const anchor = a && a.style.left ? { x: parseFloat(a.style.left), y: parseFloat(a.style.top) } : null;
        const d = mobile ? mobilePath(w, h) : desktopPath(w, h, anchor);
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        for (const p of [guide, dots, reveal]) p.setAttribute("d", d);
        mask.setAttribute("width", String(w));
        mask.setAttribute("height", String(h));
        len = guide.getTotalLength();
        reveal.style.strokeDasharray = `${len}`;
      };
      build();
      ScrollTrigger.addEventListener("refreshInit", build);

      /** Airplane + trail move to `end` (fraction of the path) over `dur`. */
      const leg = (tl: gsap.core.Timeline, start: number, end: number, dur: number, at: number, extra: gsap.TweenVars) => {
        tl.to(
          plane,
          {
            motionPath: { path: guide, align: guide, alignOrigin: [0.5, 0.5], autoRotate: PLANE_NOSE_DEG, start, end },
            duration: dur,
            ...extra,
          },
          at,
        ).fromTo(reveal, { strokeDashoffset: () => len * (1 - start) }, { strokeDashoffset: () => len * (1 - end), duration: dur }, at);
      };

      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean };
          const { takeoff, cruise } = FLIGHT_PHASES;
          // Scroll distances of each phase (in viewport heights) → timeline durations, so speed feels even.
          // Phones (no pin): the whole flight happens in the first ~85% of the scene's scroll, so the airplane has
          // left the screen before the copy scrolls up through its path.
          const D = desktop ? { takeoff: 1, cruise: 1.6, descent: 0.7 } : { takeoff: 0.35, cruise: 0.3, descent: 0.2 };
          const pin = ScrollTrigger.getById("travel");

          gsap.set(plane, { autoAlpha: 0, scale: desktop ? 0.12 : 0.5 });
          gsap.set(".journey-front-clouds", { autoAlpha: 0 });

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              id: "flight",
              trigger: travel,
              start: "top bottom",
              // desktop: through the Travel pin, plus the descent while the next scene scrolls in
              end: desktop && pin ? () => pin.end + window.innerHeight * D.descent : "bottom top",
              scrub: desktop ? 1 : 0.5,
              invalidateOnRefresh: true,
            },
          });

          const t1 = D.takeoff;
          const t2 = t1 + D.cruise;
          tl.addLabel("takeoff", 0)
            .to(plane, { autoAlpha: 1, duration: t1 * 0.15 }, 0)
            .to(".journey-trail", { autoAlpha: 1, duration: t1 * 0.2 }, 0);
          leg(tl, 0, takeoff, t1, 0, { scale: desktop ? 0.7 : 0.85 });
          tl.addLabel("cruise", t1);
          leg(tl, takeoff, cruise, D.cruise, t1, { scale: desktop ? 0.85 : 1 });
          // front clouds drift past the airplane (fastest parallax layer)
          tl.fromTo(
            ".journey-front-clouds",
            { xPercent: desktop ? 35 : 20, yPercent: 10 },
            { xPercent: desktop ? -45 : -25, yPercent: -5, duration: D.cruise + D.descent },
            t1,
          )
            .to(".journey-front-clouds", { autoAlpha: desktop ? 0.9 : 0.7, duration: D.cruise * 0.25 }, t1)
            .to(".journey-front-clouds", { autoAlpha: 0, duration: D.descent * 0.6 }, t2 + D.descent * 0.4);
          // descent towards Malta (Step 5 continues from the "descent" label)
          tl.addLabel("descent", t2);
          leg(tl, cruise, 1, D.descent, t2, { scale: desktop ? 0.45 : 0.6 });
          tl.to([plane, ".journey-trail"], { autoAlpha: 0, duration: D.descent * 0.3 }, t2 + D.descent * 0.7);
          if (!desktop) {
            // phones: clear the trail as soon as the descent starts (the copy scrolls up through it)
            tl.to(".journey-trail", { autoAlpha: 0, duration: D.descent * 0.5 }, t2);
            tl.to({}, { duration: 0.15 }); // rest of the scroll: nothing on screen
          }
        },
      );

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", build);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="journey-overlay pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden data-layer="journey-overlay">
      {/* Dotted trail, revealed behind the airplane (mask grows along the same path). */}
      <svg data-layer="flight-path" className={`journey-trail absolute inset-0 h-full w-full opacity-0 ${outline}`}>
        <defs>
          <mask id="trail-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <path className="trail-reveal" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
          </mask>
        </defs>
        <path
          className="trail-dots"
          fill="none"
          stroke="rgba(255,255,255,.9)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="0 13"
          mask="url(#trail-mask)"
        />
        <path className="trail-guide" fill="none" stroke={debug ? "rgba(255,200,0,.5)" : "none"} />
      </svg>

      <div data-layer="airplane" className={`absolute inset-0 ${outline}`}>
        <div className="journey-plane absolute left-0 top-0 opacity-0 will-change-transform">
          <picture>
            <source media="(max-width: 767px)" srcSet="/hero/airplane-mobile.webp" type="image/webp" />
            <img src="/hero/airplane.webp" alt="" width={1055} height={268} decoding="async" className="block h-auto w-full drop-shadow-[0_18px_30px_rgba(20,18,58,0.25)]" />
          </picture>
        </div>
      </div>

      <div data-layer="clouds" className={`absolute inset-0 ${outline}`}>
        <SoftClouds blobs={FRONT_CLOUDS} className="journey-front-clouds absolute -inset-x-[25%] bottom-[-18%] h-[50%] opacity-0" />
      </div>
    </div>
  );
}
