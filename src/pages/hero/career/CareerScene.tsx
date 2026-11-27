import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";
import { CAREER_PATHWAYS } from "./pathways";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);

const HEADLINE = [["Your", "Journey", "Doesn't"], ["End", "Here."], ["It", "Begins."]];
const capPath = (w: number, h: number) =>
  `M ${w * 0.62} ${-h * 0.12} C ${w * 0.68} ${h * 0.04}, ${w * 0.54} ${h * 0.16}, ${w * 0.59} ${h * 0.31}`;
const linePath = (w: number, h: number, desktop: boolean) =>
  desktop
    ? `M ${w / 2} 0 C ${w / 2} ${h * 0.18}, ${w * 0.43} ${h * 0.24}, ${w * 0.43} ${h * 0.44} S ${w * 0.52} ${h * 0.7}, ${w / 2} ${h}`
    : `M ${w / 2} 0 L ${w / 2} ${h * 0.11} M ${w / 2} ${h * 0.91} L ${w / 2} ${h}`;

export function CareerScene({ index, total }: { index: number; total: number }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const stage = el.querySelector<HTMLElement>(".career-stage")!;
      const lineSvg = el.querySelector<SVGSVGElement>(".career-line")!;
      const line = lineSvg.querySelector("path")!;
      const capSvg = el.querySelector<SVGSVGElement>(".career-cap-guide")!;
      const capGuide = capSvg.querySelector("path")!;
      let lineLength = 0;

      const measure = () => {
        const desktop = window.innerWidth >= 768;
        const width = stage.offsetWidth;
        const height = stage.offsetHeight;
        lineSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        line.setAttribute("d", linePath(width, height, desktop));
        lineLength = line.getTotalLength();
        line.style.strokeDasharray = `${lineLength}`;
        capSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        capGuide.setAttribute("d", capPath(width, height));
      };

      measure();
      ScrollTrigger.addEventListener("refreshInit", measure);

      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop } = context.conditions as { desktop: boolean };

          gsap
            .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: el, start: "top bottom", end: "top top", scrub: 0.55 } })
            .fromTo(".career-reveal", { clipPath: "circle(4% at 62% 0%)" }, { clipPath: "circle(150% at 62% 0%)", duration: 1 }, 0)
            .fromTo(".career-camera", { scale: desktop ? 1.32 : 1.12 }, { scale: desktop ? 1.16 : 1.04, duration: 1 }, 0)
            .fromTo(".career-cap", { autoAlpha: 1, rotation: 740, scale: 0.88 }, { autoAlpha: 1, rotation: 900, scale: 0.62, motionPath: { path: capGuide, align: capGuide, alignOrigin: [0.5, 0.5] }, duration: 0.78 }, 0)
            .to(".career-cap", { autoAlpha: 0, duration: 0.22 }, 0.78);

          if (desktop) {
            gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: { id: "career", trigger: el, start: "top top", end: "+=145%", pin: true, scrub: 0.75, anticipatePin: 1, invalidateOnRefresh: true },
              })
              .fromTo(".career-camera", { yPercent: -5, scale: 1.16 }, { yPercent: 4, scale: 1.03, duration: 1 }, 0)
              .fromTo(".career-parallax", { xPercent: -4, yPercent: 5 }, { xPercent: 5, yPercent: -4, duration: 1 }, 0)
              .fromTo(line, { strokeDashoffset: () => lineLength }, { strokeDashoffset: 0, duration: 0.92 }, 0.04)
              .from(".career-eyebrow", { autoAlpha: 0, y: 18, duration: 0.08 }, 0.18)
              .from(".career-word > span", { yPercent: 112, stagger: 0.025, duration: 0.13, ease: "power3.out" }, 0.21)
              .from(".career-sub", { autoAlpha: 0, y: 22, duration: 0.1, ease: "power2.out" }, 0.39)
              .from(".career-pathway", { autoAlpha: 0, x: 34, duration: 0.1, stagger: 0.07, ease: "power2.out" }, 0.46)
              .from(".career-note", { autoAlpha: 0, y: 12, duration: 0.08 }, 0.82)
              .to(".career-next", { autoAlpha: 1, duration: 0.12 }, 0.86)
              .to(".career-outro", { opacity: 1, duration: 0.14 }, 0.88);
          } else {
            gsap.fromTo(".career-camera", { yPercent: -2, scale: 1.05 }, { yPercent: 3, scale: 1, ease: "none", scrollTrigger: { trigger: stage, start: "top 80%", end: "bottom top", scrub: 0.35 } });
            gsap
              .timeline({ scrollTrigger: { trigger: ".career-copy", start: "top 82%", end: "top 28%", scrub: 0.4 } })
              .from(".career-eyebrow", { autoAlpha: 0, y: 12, duration: 0.15 }, 0)
              .from(".career-word > span", { yPercent: 110, stagger: 0.05, duration: 0.32, ease: "power3.out" }, 0.05)
              .from(".career-sub", { autoAlpha: 0, y: 16, duration: 0.24 }, 0.46);
            gsap.from(".career-pathway", { autoAlpha: 0, y: 22, stagger: 0.12, scrollTrigger: { trigger: ".career-pathways", start: "top 88%", end: "bottom 75%", scrub: 0.35 } });
            gsap.fromTo(line, { strokeDashoffset: () => lineLength }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 75%", end: "bottom 70%", scrub: 0.3, invalidateOnRefresh: true } });
          }
        },
      );

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", measure);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="career" data-chapter="career" aria-labelledby="career-title" className="career relative isolate overflow-hidden bg-navy">
      <div className="career-stage hero-scene relative flex">
        <div className="career-reveal absolute inset-0 -z-10 overflow-hidden">
          <div className="career-camera absolute -inset-y-[6%] inset-x-0 will-change-transform">
            <picture>
              <source media="(max-width: 767px)" srcSet="/hero/career-mobile.webp" type="image/webp" />
              <source media="(min-width: 768px) and (max-width: 1180px) and (orientation: portrait)" srcSet="/hero/career-portrait.webp" type="image/webp" />
              <source srcSet="/hero/career-1100.webp 1100w, /hero/career-1680.webp 1680w" sizes="100vw" type="image/webp" />
              <img src="/hero/career-1680.webp" alt="Young international professionals collaborating in a modern Malta workplace" width={1680} height={946} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </picture>
          </div>
          <div className="career-parallax absolute -inset-[8%] bg-[radial-gradient(circle_at_72%_24%,rgba(255,214,156,.24),transparent_22%)] mix-blend-screen" />
          <div className="career-scrim absolute inset-0" />
          <div className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-b from-navy/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-navy to-transparent" />
        </div>

        <div className="career-layout hero-container hero-scene-pad relative z-10 grid w-full content-end gap-8 md:grid-cols-[minmax(0,1.08fr)_minmax(18rem,.72fr)] md:items-end md:gap-12 md:pb-[11vh]">
          <div className="career-copy max-w-[50rem]">
            <p className="career-eyebrow text-xs font-bold uppercase tracking-[0.32em] text-white/80 sm:text-sm">
              <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
              <span className="mx-2 text-white/50">/ {String(total).padStart(2, "0")}</span>
              Career
            </p>
            <h2 id="career-title" className="career-title mt-4 font-extrabold text-white">
              {HEADLINE.map((line, lineIndex) => (
                <span key={lineIndex} className="block">
                  {line.map((word) => (
                    <span key={word} className="career-word"><span className={lineIndex === 2 ? "hero-accent" : undefined}>{word}</span></span>
                  ))}
                </span>
              ))}
            </h2>
            <p className="career-sub mt-5 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
              Turn your education into ambition, opportunity and a brighter professional future.
            </p>
          </div>

          <div className="career-pathways grid gap-2.5" aria-label="Career pathways connected to our academic programmes">
            {CAREER_PATHWAYS.map((pathway, pathwayIndex) => (
              <article key={pathway.key} className="career-pathway rounded-xl border border-white/20 bg-navy/55 p-3.5 backdrop-blur-md sm:p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 text-xs font-bold tracking-[0.2em] text-white/55">{String(pathwayIndex + 1).padStart(2, "0")}</span>
                  <div><h3 className="font-bold leading-tight text-white">{pathway.title}</h3><p className="mt-1 text-xs leading-relaxed text-white/65 sm:text-sm">{pathway.note}</p></div>
                </div>
              </article>
            ))}
            <p className="career-note mt-1 text-[11px] leading-relaxed text-white/60">Pathways reflect the academic programmes currently listed on this site. Career outcomes depend on individual circumstances and market conditions.</p>
          </div>
        </div>

        <svg className="career-cap-guide pointer-events-none absolute inset-0 h-full w-full" aria-hidden><path fill="none" stroke="none" /></svg>
        <img src="/hero/grad-cap.webp" alt="" width={153} height={231} className="career-cap pointer-events-none absolute left-0 top-0 z-20 w-[18vw] max-w-[130px] opacity-0 md:w-[9vw] md:max-w-[160px]" aria-hidden />
        <svg className="career-line pointer-events-none absolute inset-0 z-[5] h-full w-full" aria-hidden><path fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" strokeLinecap="round" /></svg>
        <div className="career-next pointer-events-none absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60 opacity-0 md:flex" aria-hidden>
          <span>Your next step</span><ArrowDown className="h-4 w-4" />
        </div>
        <div className="career-outro pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[28%] bg-gradient-to-t from-navy to-transparent opacity-0" aria-hidden />
      </div>
    </section>
  );
}
