import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SoftClouds, type Blob } from "./CloudBank";
import { PLANE_NOSE_DEG, desktopFlight, mobileFlight, type Pt } from "./flight";
import { JOURNEY_DESKTOP_MIN, JOURNEY_MEDIA, JOURNEY_PIN, JOURNEY_REFRESH, JOURNEY_SCRUB } from "./animation";


const FRONT_CLOUDS: Blob[] = [[0, 30, 34, 80, 0.85], [28, 50, 26, 60, 0.6], [62, 35, 38, 85, 0.85], [92, 55, 26, 55, 0.6]];

/** Position written by a scene on its [data-anchor] element (section-relative px = viewport px while pinned). */
const readAnchor = (name: string): Pt | null => {
  const a = document.querySelector<HTMLElement>(`[data-anchor='${name}']`);
  return a && a.style.left ? { x: parseFloat(a.style.left), y: parseFloat(a.style.top) } : null;
};

/**
 * Shared, fixed layer above every scene — the one animation system for the whole journey:
 * the flight trail, the airplane, the front clouds and the journey line. One scrubbed timeline
 * (ScrollTrigger id "flight") with labels per chapter:
 *   takeoff → cruise → descent → arrival (Malta) → onwards (towards Study, Step 6)
 * Scenes contribute anchors ([data-anchor='takeoff'], [data-anchor='malta']) and pins (ids
 * "travel", "malta"); this component turns them into one continuous flight.
 *
 * Must render AFTER <main> so its ScrollTrigger is created after the scenes' pins (correct order).
 * Hidden entirely for prefers-reduced-motion. Add ?debug=overlay to outline the layers.
 */
export function JourneyOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const debug = new URLSearchParams(window.location.search).get("debug") === "overlay";
  const outline = debug ? "outline outline-1 outline-dashed outline-amber-300/60" : "";

  useGSAP(
    () => {
      const el = root.current!;
      const svg = el.querySelector<SVGSVGElement>("[data-layer='flight-path']")!;
      const guides = [...el.querySelectorAll<SVGPathElement>(".trail-guide")];
      const dots = el.querySelector<SVGPathElement>(".trail-dots")!;
      const line = el.querySelector<SVGPathElement>(".trail-line")!;
      const next = el.querySelector<SVGPathElement>(".journey-next")!;
      const reveal = el.querySelector<SVGPathElement>(".trail-reveal")!;
      const mask = el.querySelector<SVGMaskElement>("#trail-mask")!;
      const plane = el.querySelector<HTMLElement>(".journey-plane")!;
      const travel = document.getElementById("travel");
      const malta = document.getElementById("malta");
      if (!travel || !malta) return;

      // Lengths: total trail, cumulative end of each leg, and the onward journey line.
      let total = 0;
      let cum = [0, 0, 0];
      let nextLen = 0;

      // (Re)build every path for the current viewport; runs before every refresh.
      const build = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const g = w < JOURNEY_DESKTOP_MIN ? mobileFlight(w, h) : desktopFlight(w, h, readAnchor("takeoff"), readAnchor("malta"));
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        for (const p of [dots, line, reveal]) p.setAttribute("d", g.full);
        g.legs.forEach((d, i) => guides[i].setAttribute("d", d));
        next.setAttribute("d", g.next ?? "M 0 0");
        mask.setAttribute("width", String(w));
        mask.setAttribute("height", String(h));
        total = reveal.getTotalLength();
        let acc = 0;
        cum = guides.map((p) => (acc += p.getTotalLength()));
        reveal.style.strokeDasharray = `${total}`;
        nextLen = g.next ? next.getTotalLength() : 0;
        next.style.strokeDasharray = `${nextLen}`;
      };
      build();
      ScrollTrigger.addEventListener("refreshInit", build);

      /** Airplane follows leg `i`; the trail reveals up to the end of that leg. */
      const leg = (tl: gsap.core.Timeline, i: number, dur: number, at: number, extra: gsap.TweenVars, rotate = PLANE_NOSE_DEG) => {
        tl.to(plane, { motionPath: { path: guides[i], align: guides[i], alignOrigin: [0.5, 0.5], autoRotate: rotate }, duration: dur, ...extra }, at).fromTo(
          reveal,
          { strokeDashoffset: () => total - (i ? cum[i - 1] : 0) },
          { strokeDashoffset: () => total - cum[i], duration: dur },
          at,
        );
      };

      const mm = gsap.matchMedia();
      mm.add(
        JOURNEY_MEDIA,
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean };
          const travelPin = ScrollTrigger.getById("travel");
          const maltaPin = ScrollTrigger.getById("malta");
          // Scroll distance of each phase in viewport heights → timeline durations (speed feels even).
          //  desktop: takeoff = Travel scrolling in · cruise = Travel pin · descent = Malta scrolling in ·
          //           arrival = Malta pin · onwards = Malta scrolling out.
          //  compact layouts (no pins): the flight spans Travel and Malta, using native scrolling.
          const D = desktop
            ? { takeoff: 1, cruise: JOURNEY_PIN.travel / 100, descent: 1, arrival: JOURNEY_PIN.malta / 100, onwards: 1 }
            : { takeoff: 0.28, cruise: 0.32, descent: 0.32, arrival: 0, onwards: 0 };

          gsap.set(plane, { autoAlpha: 0, scale: desktop ? 0.12 : 0.5 });
          gsap.set(".journey-front-clouds", { autoAlpha: 0 });
          gsap.set(line, { autoAlpha: 0 });

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              id: "flight",
              trigger: travel,
              // Use the element, not a selector string: this GSAP context is scoped to the fixed
              // overlay, while #malta lives outside it in <main>.
              endTrigger: desktop ? undefined : malta,
              start: "top bottom",
              end:
                desktop && travelPin
                  ? () => (maltaPin ? maltaPin.end : travelPin.end + window.innerHeight * D.descent) + window.innerHeight * D.onwards
                  : "bottom top",
              scrub: desktop ? JOURNEY_SCRUB.overlayDesktop : JOURNEY_SCRUB.overlayMobile,
              invalidateOnRefresh: true,
              refreshPriority: JOURNEY_REFRESH.overlay,
            },
          });

          const t1 = D.takeoff;
          const t2 = t1 + D.cruise;
          const t3 = t2 + D.descent;
          const t4 = t3 + D.arrival;

          // --- takeoff
          tl.addLabel("takeoff", 0)
            .to(plane, { autoAlpha: 1, duration: t1 * 0.15 }, 0)
            .to(".journey-trail", { autoAlpha: 1, duration: t1 * 0.2 }, 0);
          leg(tl, 0, t1, 0, { scale: desktop ? 0.7 : 0.85 });

          // --- cruise
          tl.addLabel("cruise", t1);
          leg(tl, 1, D.cruise, t1, { scale: desktop ? 0.85 : 1 });
          tl.fromTo(
            ".journey-front-clouds",
            { xPercent: desktop ? 35 : 20, yPercent: 10 },
            { xPercent: desktop ? -45 : -25, yPercent: -5, duration: D.cruise + D.descent },
            t1,
          )
            .to(".journey-front-clouds", { autoAlpha: desktop ? 0.9 : 0.7, duration: D.cruise * 0.25 }, t1)
            .to(".journey-front-clouds", { autoAlpha: 0, duration: D.descent * 0.5 }, t2 + D.descent * 0.5);

          // --- descent (desktop: onto the Valletta marker; phones: off the right edge)
          tl.addLabel("descent", t2);
          leg(tl, 2, D.descent, t2, { scale: desktop ? 0.42 : 0.6 }, desktop ? 6 : PLANE_NOSE_DEG);

          if (!desktop) {
            tl.to(".journey-trail", { autoAlpha: 0, duration: D.descent * 0.35 }, t2 + D.descent * 0.65);
            tl.to(plane, { autoAlpha: 0, duration: D.descent * 0.3 }, t2 + D.descent * 0.7);
            tl.to({}, { duration: 0.08 });
            return;
          }

          // --- arrival (Malta pinned): touch down, the trail becomes the journey line, the line continues
          tl.addLabel("arrival", t3)
            .to(plane, { scale: 0.14, autoAlpha: 0, duration: D.arrival * 0.3, ease: "power1.in" }, t3)
            .to(dots, { autoAlpha: 0, duration: D.arrival * 0.2 }, t3 + D.arrival * 0.25)
            .to(line, { autoAlpha: 1, duration: D.arrival * 0.2 }, t3 + D.arrival * 0.25)
            .fromTo(next, { strokeDashoffset: () => nextLen }, { strokeDashoffset: 0, duration: D.arrival * 0.45 }, t3 + D.arrival * 0.5);

          // --- onwards (Malta scrolls out): the line travels up with the page; Step 6 picks it up
          tl.addLabel("onwards", t4).fromTo(svg, { y: 0 }, { y: () => -window.innerHeight, duration: D.onwards }, t4);
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
      {/* Trail (dotted while flying, solid journey line after arrival), revealed behind the airplane. */}
      <svg data-layer="flight-path" className={`journey-trail absolute inset-0 h-full w-full opacity-0 ${outline}`}>
        <defs>
          <mask id="trail-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <path className="trail-reveal" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
          </mask>
        </defs>
        <path className="trail-dots" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0 13" mask="url(#trail-mask)" />
        <path className="trail-line" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" strokeLinecap="round" mask="url(#trail-mask)" />
        <path className="journey-next" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <path key={i} className="trail-guide" fill="none" stroke={debug ? "rgba(255,200,0,.6)" : "none"} />
        ))}
      </svg>

      <div data-layer="airplane" className={`absolute inset-0 ${outline}`}>
        <div className="journey-plane absolute left-0 top-0 opacity-0 will-change-transform">
          <picture>
            <source media="(max-width: 1023px)" srcSet="/hero/airplane-mobile.webp" type="image/webp" />
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
