import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ProgrammeExplorer } from "./ProgrammeExplorer";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const LQIP = "data:image/webp;base64,UklGRt4AAABXRUJQVlA4INIAAAAQBgCdASogABEAPu1mrE+ppSQiMBgIATAdiWIAv2qAuAFJCgzXxGgAG5gP9Or8KS/H9OyvwzYmlLIA/ug3tEDbk4p5tlsVDWHXtL2kzNoOiYr8Jvv7t2YHqyjEH0/Rtss63J48IWQx8iIqNbbQjNWmd8lyBMVpmOq/Rq3kwp0Sx+j9yqq6L3r1Vb57hwomzs8DH42N7Dv2+xjhA2S0QITabXd7L074NxAp/xr/Mn61tUay2/GI7atBtefg1XyCwqUG6KvpFJMzR8HxVNQFOycAAAA=";
const HEADLINE = [["Learn", "Today."], ["Lead", "Tomorrow."]];

/**
 * Scene 4 — Study. From Malta's aerial view into university life, then the programmes.
 *
 *  1. Cinematic photo: the library opens like a window as the scene scrolls in (clip-path), with a
 *     subtle camera zoom and parallax; headline and subtitle rise in.
 *  2. Programmes: editorial list + detail panel (ProgrammeExplorer), staggered on scroll.
 *  The journey line continues from the overlay's line (which leaves Malta at ~74% across) down the
 *  photo, through the programme divider and out at the bottom centre towards Graduation (Step 7).
 *
 * No pins (normal scrolling everywhere); all scroll animations are scrubbed, so they reverse.
 * gsap.matchMedia: desktop (≥1024: window reveal + divider line), tablet/phone (light fades), reduced motion (static).
 */
export function StudyScene({ index, total }: { index: number; total: number }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const svg = el.querySelector<SVGSVGElement>(".study-line")!;
      const path = svg.querySelector<SVGPathElement>("path")!;
      let len = 0;

      // Journey line through the scene, measured from the layout (rebuilt on every refresh).
      const build = () => {
        const W = el.offsetWidth;
        const H = el.offsetHeight;
        const box = el.getBoundingClientRect();
        const heroH = el.querySelector<HTMLElement>(".study-hero")!.offsetHeight;
        const divider = el.querySelector<HTMLElement>(".prog-divider");
        const d = divider?.getBoundingClientRect();
        const desktop = window.innerWidth >= 1024 && d && d.width > 0;
        let dPath: string;
        if (desktop) {
          const x = d.left - box.left;
          const top = d.top - box.top;
          const bottom = d.bottom - box.top;
          dPath = [
            `M ${0.74 * W} 0`,
            `C ${0.74 * W} ${heroH * 0.35}, ${0.9 * W} ${heroH * 0.55}, ${0.86 * W} ${heroH * 0.8}`,
            `C ${0.83 * W} ${heroH * 1.0}, ${x} ${top - 140}, ${x} ${top}`,
            `L ${x} ${bottom}`,
            `C ${x} ${bottom + 80}, ${W / 2} ${H - 120}, ${W / 2} ${H}`,
          ].join(" ");
        } else {
          // phones/tablets: a short line in from Malta at the top, and out to the next scene at the bottom
          dPath = `M ${W / 2} 0 L ${W / 2} ${heroH * 0.16} M ${W / 2} ${H - 90} L ${W / 2} ${H}`;
        }
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        path.setAttribute("d", dPath);
        len = path.getTotalLength();
        path.style.strokeDasharray = `${len}`;
      };
      build();
      ScrollTrigger.addEventListener("refreshInit", build);

      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          compact: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { desktop } = ctx.conditions as { desktop: boolean };
          const hero = el.querySelector(".study-hero")!;

          // 1. Transition from Malta: the library opens like a window, camera settles.
          gsap
            .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: hero, start: "top bottom", end: "top top", scrub: 0.6 } })
            .fromTo(
              ".study-window",
              { clipPath: desktop ? "inset(16% 10% 0% 10% round 36px)" : "inset(6% 4% 0% 4% round 24px)" },
              { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1 },
              0,
            )
            .fromTo(".study-cam", { scale: desktop ? 1.25 : 1.1 }, { scale: 1.06, duration: 1 }, 0);

          // Parallax inside the photo while it scrolls past: background slower, copy faster.
          gsap
            .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 } })
            .to(".study-cam", { yPercent: desktop ? 12 : 6, scale: 1.12, duration: 1 }, 0)
            .to(".study-copy", { yPercent: desktop ? -30 : -12, autoAlpha: 0.2, duration: 1 }, 0);

          // Headline + subtitle.
          gsap
            .timeline({ scrollTrigger: { trigger: hero, start: "top 55%", end: "top 0%", scrub: 0.5 } })
            .from(".study-eyebrow", { autoAlpha: 0, y: 16, ease: "power2.out", duration: 0.2 }, 0)
            .from(".study-word > span", { yPercent: 110, stagger: 0.08, ease: "power3.out", duration: 0.4 }, 0.05)
            .from(".study-sub", { autoAlpha: 0, y: 24, ease: "power2.out", duration: 0.3 }, 0.45);

          // 2. Programmes: intro, then rows staggered, then the panel.
          gsap
            .timeline({ scrollTrigger: { trigger: ".study-programmes", start: "top 80%", end: desktop ? "top 25%" : "top 35%", scrub: 0.5 } })
            .from(".study-prog-intro > *", { autoAlpha: 0, y: 30, stagger: 0.1, ease: "power2.out", duration: 0.3 }, 0)
            .from(".prog-row", { autoAlpha: 0, x: desktop ? -40 : 0, y: desktop ? 0 : 18, stagger: 0.06, ease: "power2.out", duration: 0.3 }, 0.15)
            .from(".prog-panel", { autoAlpha: 0, y: 40, ease: "power2.out", duration: 0.4 }, 0.3);

          // Journey line, drawn down to whatever is at 70% of the screen.
          gsap.fromTo(
            path,
            { strokeDashoffset: () => len },
            { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 70%", scrub: 0.3, invalidateOnRefresh: true } },
          );

          // Towards Graduation (Step 7): the scene's last screen dims into navy.
          gsap.fromTo(".study-outro", { opacity: 0 }, { opacity: 1, ease: "none", scrollTrigger: { trigger: el, start: "bottom 90%", end: "bottom 30%", scrub: 0.5 } });
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
    <section ref={root} id="study" data-chapter="study" aria-labelledby="study-title" className="study relative isolate overflow-hidden bg-navy">
      {/* 1 — cinematic photo */}
      <div className="study-hero hero-scene relative flex">
        <div className="study-window absolute inset-0 -z-10 overflow-hidden">
          <div className="study-cam absolute inset-0 will-change-transform">
            <picture>
              <source media="(max-width: 767px)" srcSet="/hero/study-mobile.webp" type="image/webp" />
              <source media="(min-width: 768px) and (max-width: 1180px) and (orientation: portrait)" srcSet="/hero/study-portrait.webp" type="image/webp" />
              <source srcSet="/hero/study-1024.webp 1024w, /hero/study-1408.webp 1408w" sizes="100vw" type="image/webp" />
              <img
                src="/hero/study-1408.webp"
                alt="International student studying on a laptop in a bright university library"
                width={1408}
                height={768}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
                style={{ backgroundImage: `url(${LQIP})`, backgroundSize: "cover", backgroundPosition: "center" }}
              />
            </picture>
          </div>
          <div className="study-scrim absolute inset-0" />
          <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-navy to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-navy to-transparent" />
        </div>

        <div className="study-copy hero-container hero-scene-pad relative z-10 flex w-full items-end md:pb-[14vh]">
          <div className="max-w-[44rem] lg:max-w-[50rem]">
            <p className="study-eyebrow text-xs font-bold uppercase tracking-[0.32em] text-white/80 sm:text-sm">
              <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
              <span className="mx-2 text-white/50">/ {String(total).padStart(2, "0")}</span>
              Study
            </p>
            <h2 id="study-title" className="study-title mt-4 font-extrabold text-white">
              {HEADLINE.map((line, li) => (
                <span key={li} className="block">
                  {line.map((w, wi) => (
                    <span key={wi} className="study-word">
                      <span className={li === HEADLINE.length - 1 ? "hero-accent" : undefined}>{w}</span>
                    </span>
                  ))}
                </span>
              ))}
            </h2>
            <p className="study-sub mt-5 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
              Discover international education, develop your skills and prepare for your future career.
            </p>
          </div>
        </div>
      </div>

      {/* 2 — programmes */}
      <div className="study-programmes hero-container relative z-10 pb-28 pt-10 sm:pb-36 lg:pt-16">
        <div className="study-prog-intro mb-10 max-w-2xl lg:mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/60 sm:text-sm">Academic programmes in Malta</p>
          <p className="mt-3 text-2xl font-extrabold leading-snug text-white sm:text-3xl">Choose your field. We'll match you with the right school.</p>
        </div>
        <ProgrammeExplorer />
      </div>

      {/* Journey line (continues the overlay's line from Malta) */}
      <svg className="study-line pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden>
        <path fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {/* Hand-off towards Graduation */}
      <div className="study-outro pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy to-transparent opacity-0" aria-hidden />
    </section>
  );
}
