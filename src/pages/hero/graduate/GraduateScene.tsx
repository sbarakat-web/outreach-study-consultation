import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Diploma } from "./Diploma";
import { JOURNEY_MEDIA, JOURNEY_PIN, JOURNEY_REFRESH, JOURNEY_SCRUB } from "../animation";


const LQIP = "data:image/webp;base64,UklGRtwAAABXRUJQVlA4INAAAACQBQCdASogABIAPu1kqU2ppaOiMAgBMB2JbACxFIDHAAE/VnWDZ+5Yt27GYz6C3Rat3UFYgAD9EGyemOshQpgRbgb9ekvcSAzAmZfIjv5Y3UdVi/pDLst9VsvGFUEWO6pCvgY2xbRxXawEgaNOSys/dzpDHXgubgDnsocLFD2Ey8A2Yw6eRfEjEuUber1B5/Hl00HA5EUuOIrqHm/38IPWvxUhBsL3YLNx2s8apYGPbGCjzgMZwqjriGMj/dq+UbGB+Bo58ojSsC27E9zP+AAA";
const HEADLINE = [["From", "Ambition"], ["to", "Achievement."]];

/** Cap flight in stage pixels: from the graduates' hands, a rising arc, out of the top of the frame. */
const capPath = (W: number, H: number) =>
  `M ${0.58 * W} ${0.9 * H} C ${0.52 * W} ${0.62 * H}, ${0.36 * W} ${0.42 * H}, ${0.44 * W} ${0.2 * H} C ${0.5 * W} ${0.04 * H}, ${0.6 * W} ${-0.08 * H}, ${0.62 * W} ${-0.35 * H}`;

/** Journey line: in at the top centre (from Study), past the diploma, out at the bottom centre (towards Career). */
const linePath = (W: number, H: number, desktop: boolean) =>
  desktop
    ? `M ${W / 2} 0 C ${W / 2} ${0.22 * H}, ${0.58 * W} ${0.3 * H}, ${0.58 * W} ${0.52 * H} C ${0.58 * W} ${0.74 * H}, ${W / 2} ${0.82 * H}, ${W / 2} ${H}`
    : `M ${W / 2} 0 L ${W / 2} ${0.12 * H} M ${W / 2} ${H - 80} L ${W / 2} ${H}`;

/**
 * Scene 5 — Graduate. University life → graduation day.
 *
 * Layers (back → front): graduation photo in a camera wrapper · light flare · scrims · journey line ·
 * copy · diploma · flying cap (a real cap cut out of the photo, transparent WebP).
 *  - desktop/tablet (≥768): the photo blooms open from the top centre where the Study line arrives,
 *    then a short pin (+=140%, id "graduate"): the cap flies up on a MotionPath (rotation + scale)
 *    while the camera tilts up after it, headline rises, diploma unrolls; ends on "towards-career".
 *  - phones: no pin — simple vertical cap rise, fades and a light zoom; the diploma follows below.
 *  - reduced motion: static.
 */
export function GraduateScene({ index, total }: { index: number; total: number }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const stage = el.querySelector<HTMLElement>(".grad-stage")!;
      const svg = el.querySelector<SVGSVGElement>(".grad-line")!;
      const line = svg.querySelector("path")!;
      const capSvg = el.querySelector<SVGSVGElement>(".grad-cap-guide")!;
      const capGuide = capSvg.querySelector("path")!;
      let len = 0;

      const build = () => {
        const desktop = window.innerWidth >= 768;
        const W = el.offsetWidth;
        const H = el.offsetHeight;
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        line.setAttribute("d", linePath(W, H, desktop));
        len = line.getTotalLength();
        line.style.strokeDasharray = `${len}`;
        capSvg.setAttribute("viewBox", `0 0 ${stage.offsetWidth} ${stage.offsetHeight}`);
        capGuide.setAttribute("d", capPath(stage.offsetWidth, stage.offsetHeight));
      };
      build();
      ScrollTrigger.addEventListener("refreshInit", build);

      const mm = gsap.matchMedia();
      mm.add(
        JOURNEY_MEDIA,
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean };

          // Study → Graduate: the photo blooms open from where the journey line comes in (top centre).
          gsap
            .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: el, start: "top bottom", end: "top top", scrub: 0.6 } })
            .fromTo(
              ".grad-reveal",
              { clipPath: desktop ? "circle(0% at 50% 0%)" : "circle(8% at 50% 0%)" },
              { clipPath: "circle(150% at 50% 0%)", duration: 1 },
              0,
            )
            .fromTo(".grad-cam", { scale: desktop ? 1.35 : 1.15 }, { scale: desktop ? 1.15 : 1.04, duration: 1 }, 0);


          if (desktop) {
            const tl = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: { id: "graduate", trigger: el, start: "top top", end: `+=${JOURNEY_PIN.graduate}%`, pin: true, scrub: JOURNEY_SCRUB.desktop, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: JOURNEY_REFRESH.graduate },
            });
            tl.addLabel("throw", 0)
              // the cap: thrown up, spinning, coming towards the camera then away
              .fromTo(".grad-cap", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0)
              .to(".grad-cap", { motionPath: { path: capGuide, align: capGuide, alignOrigin: [0.5, 0.5] }, duration: 0.72 }, 0)
              .fromTo(".grad-cap", { rotation: -20, scale: 0.55 }, { rotation: 560, scale: 1.7, duration: 0.42, ease: "power1.out" }, 0)
              .to(".grad-cap", { rotation: 760, scale: 0.9, duration: 0.3, ease: "power1.in" }, 0.42)
              // camera follows the cap up (background tilts down), layered parallax
              .fromTo(".grad-cam", { yPercent: -5 }, { yPercent: 7, scale: 1.05, duration: 0.75, ease: "power1.inOut" }, 0)
              .fromTo(".grad-flare", { xPercent: -10, yPercent: 10, opacity: 0.4 }, { xPercent: 12, yPercent: -8, opacity: 0.9, duration: 0.8 }, 0)
              // journey line
              .fromTo(line, { strokeDashoffset: () => len }, { strokeDashoffset: 0, duration: 0.95 }, 0)
              // headline + subtitle
              .from(".grad-eyebrow", { autoAlpha: 0, y: 16, duration: 0.08, ease: "power2.out" }, 0.22)
              .from(".grad-word > span", { yPercent: 110, duration: 0.14, stagger: 0.03, ease: "power3.out" }, 0.25)
              .from(".grad-sub", { autoAlpha: 0, y: 24, duration: 0.1, ease: "power2.out" }, 0.42)
              // diploma unrolls
              .addLabel("diploma", 0.46)
              .from(".grad-diploma-wrap .grad-diploma-cap", { autoAlpha: 0, y: 10, duration: 0.06 }, "diploma")
              .from(".grad-diploma-wrap .grad-paper", { scaleY: 0.04, autoAlpha: 0, rotation: -6, duration: 0.16, ease: "power3.out" }, "diploma")
              .from(".grad-diploma-wrap .grad-paper-inner", { autoAlpha: 0, y: 14, duration: 0.1 }, "diploma+=0.1")
              .from(".grad-diploma-wrap .grad-seal", { scale: 0, rotation: -90, duration: 0.08, ease: "back.out(2)" }, "diploma+=0.18")
              .fromTo(".grad-diploma-wrap .grad-shine", { xPercent: 0 }, { xPercent: 520, duration: 0.14 }, "diploma+=0.22")
              .from(".grad-diploma-wrap .grad-facts", { autoAlpha: 0, duration: 0.08 }, "diploma+=0.24")
              // towards Career: the scene settles and dims into the next chapter
              .to(".grad-outro", { opacity: 1, duration: 0.15 }, 0.85)
              .addLabel("towards-career", 1);
          } else {
            // phones: simple vertical rise of the cap through the photo, tied to scroll
            gsap.set(".grad-cap", { xPercent: -50, yPercent: -50 });
            gsap
              .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: stage, start: "top 70%", end: "bottom top", scrub: 0.4 } })
              .fromTo(".grad-cap", { x: () => stage.offsetWidth * 0.55, y: () => stage.offsetHeight * 0.85, rotation: -10, scale: 0.7, autoAlpha: 0 }, { y: () => -stage.offsetHeight * 0.15, rotation: 380, scale: 1.1, autoAlpha: 1, duration: 1 }, 0)
              .to(".grad-cap", { autoAlpha: 0, duration: 0.1 }, 0.9)
              .fromTo(".grad-cam", { yPercent: -3 }, { yPercent: 5, duration: 1 }, 0);
            gsap
              .timeline({ scrollTrigger: { trigger: stage, start: "top 55%", end: "top 0%", scrub: 0.5 } })
              .from(".grad-eyebrow", { autoAlpha: 0, y: 16, duration: 0.2 }, 0)
              .from(".grad-word > span", { yPercent: 110, stagger: 0.08, duration: 0.4, ease: "power3.out" }, 0.05)
              .from(".grad-sub", { autoAlpha: 0, y: 20, duration: 0.3 }, 0.45);
            gsap
              .timeline({ scrollTrigger: { trigger: ".grad-diploma-mobile", start: "top 85%", end: "top 35%", scrub: 0.5 } })
              .from(".grad-diploma-mobile .grad-diploma-cap", { autoAlpha: 0, y: 10, duration: 0.15 }, 0)
              .from(".grad-diploma-mobile .grad-paper", { scaleY: 0.05, autoAlpha: 0, duration: 0.45, ease: "power3.out" }, 0.05)
              .from(".grad-diploma-mobile .grad-paper-inner", { autoAlpha: 0, y: 12, duration: 0.3 }, 0.35)
              .from(".grad-diploma-mobile .grad-seal", { scale: 0, duration: 0.2, ease: "back.out(2)" }, 0.6)
              .from(".grad-diploma-mobile .grad-facts", { autoAlpha: 0, duration: 0.2 }, 0.75);
            gsap.fromTo(line, { strokeDashoffset: () => len }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 70%", scrub: 0.3, invalidateOnRefresh: true } });
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
    <section ref={root} id="graduate" data-chapter="graduate" aria-labelledby="graduate-title" className="graduate relative isolate overflow-hidden bg-navy">
      <div className="grad-stage hero-scene relative flex">
        {/* Photo (revealed from the top centre) → camera */}
        <div className="grad-reveal absolute inset-0 -z-10 overflow-hidden">
          <div className="grad-cam absolute -inset-y-[6%] inset-x-0 will-change-transform">
            <picture>
              <source media="(max-width: 767px)" srcSet="/hero/graduate-mobile.webp" type="image/webp" />
              <source media="(min-width: 768px) and (max-width: 1180px) and (orientation: portrait)" srcSet="/hero/graduate-portrait.webp" type="image/webp" />
              <source srcSet="/hero/graduate-1100.webp 1100w, /hero/graduate-1680.webp 1680w" sizes="100vw" type="image/webp" />
              <img
                src="/hero/graduate-1680.webp"
                alt="International graduates throwing their caps into a clear blue sky"
                width={1680}
                height={940}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                style={{ backgroundImage: `url(${LQIP})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            </picture>
          </div>
          <div
            className="grad-flare absolute -inset-[15%] mix-blend-screen"
            style={{ background: "radial-gradient(circle at 78% 18%, rgba(255,255,255,.45), rgba(255,255,255,0) 22%)" }}
          />
          <div className="grad-scrim absolute inset-0" />
          <div className="absolute inset-x-0 top-0 h-[20%] bg-gradient-to-b from-navy/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-navy to-transparent" />
        </div>

        <div className="grad-copy hero-container hero-scene-pad relative z-10 flex w-full items-end md:pb-[14vh]">
          <div className="max-w-[44rem] md:max-w-[58%]">
            <p className="grad-eyebrow text-xs font-bold uppercase tracking-[0.32em] text-white/80 sm:text-sm">
              <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
              <span className="mx-2 text-white/50">/ {String(total).padStart(2, "0")}</span>
              Graduate
            </p>
            <h2 id="graduate-title" className="grad-title mt-4 font-extrabold text-white">
              {HEADLINE.map((line, li) => (
                <span key={li} className="block">
                  {line.map((w, wi) => (
                    <span key={wi} className="grad-word">
                      <span className={li === HEADLINE.length - 1 && wi === line.length - 1 ? "hero-accent" : undefined}>{w}</span>
                    </span>
                  ))}
                </span>
              ))}
            </h2>
            <p className="grad-sub mt-5 max-w-md text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
              Celebrate your achievements and open the door to new opportunities.
            </p>
          </div>
        </div>

        {/* Diploma — desktop/tablet: over the sky on the right */}
        <div className="grad-diploma-wrap absolute end-[8%] top-[16%] z-10 hidden w-[min(28vw,380px)] md:block lg:end-[14%]">
          <Diploma />
        </div>

        {/* The cap's flight path (desktop MotionPath guide, invisible) */}
        <svg className="grad-cap-guide pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <path fill="none" stroke="none" />
        </svg>
        {/* The flying cap (real cap cut out of the photo) */}
        <img src="/hero/grad-cap.webp" alt="" width={153} height={231} className="grad-cap pointer-events-none absolute left-0 top-0 z-20 w-[22vw] max-w-[150px] opacity-0 md:w-[11vw] md:max-w-[190px]" aria-hidden />
      </div>

      {/* Diploma — phones: below the photo */}
      <div className="grad-diploma-mobile hero-container relative z-10 pb-24 pt-6 md:hidden">
        <Diploma />
      </div>

      <svg className="grad-line pointer-events-none absolute inset-0 z-[5] h-full w-full" aria-hidden>
        <path fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="grad-outro pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/3 bg-gradient-to-t from-navy to-transparent opacity-0" aria-hidden />
    </section>
  );
}
