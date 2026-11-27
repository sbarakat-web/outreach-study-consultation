import { createContext, useContext, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Chapter } from "./chapters";
import { JOURNEY_REFRESH } from "./animation";

ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });

type JourneyState = { active: number };
const JourneyContext = createContext<JourneyState>({ active: 0 });

export function useJourneyState() {
  return useContext(JourneyContext);
}

/**
 * Journey-wide lifecycle and progress owner. Section components keep their visual timelines, while
 * this controller owns chapter state, refresh ordering and all media/viewport recalculation.
 */
export function JourneyController({ chapters, children, dir }: { chapters: Chapter[]; children: ReactNode; dir: "ltr" | "rtl" }) {
  const root = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const el = root.current!;
      const sections = chapters.map((chapter) => document.getElementById(chapter.id)).filter((section): section is HTMLElement => !!section);

      const updateActive = () => {
        const focus = window.innerHeight * 0.5;
        let next = 0;
        let distance = Number.POSITIVE_INFINITY;
        sections.forEach((section, index) => {
          const rect = section.getBoundingClientRect();
          const currentDistance = rect.top <= focus && rect.bottom >= focus ? 0 : Math.min(Math.abs(rect.top - focus), Math.abs(rect.bottom - focus));
          if (currentDistance < distance) {
            distance = currentDistance;
            next = index;
          }
        });
        if (next !== activeRef.current) {
          activeRef.current = next;
          setActive(next);
          document.dispatchEvent(new CustomEvent("hero:chapter-change", { detail: { index: next, id: chapters[next]?.id } }));
        }
      };

      const master = ScrollTrigger.create({
        id: "journey-controller",
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        refreshPriority: JOURNEY_REFRESH.controller,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          el.style.setProperty("--journey-progress", String(self.progress));
          updateActive();
        },
        onRefresh: updateActive,
      });

      let frame = 0;
      const refresh = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => ScrollTrigger.refresh());
      };
      const observer = new ResizeObserver(refresh);
      observer.observe(el);

      const images = [...el.querySelectorAll<HTMLImageElement>("img")];
      const pendingImages = images.filter((image) => !image.complete);
      pendingImages.forEach((image) => {
        image.addEventListener("load", refresh, { once: true });
        image.addEventListener("error", refresh, { once: true });
      });
      void Promise.allSettled(images.map((image) => image.decode?.())).then(refresh);
      void document.fonts?.ready.then(refresh);
      window.addEventListener("load", refresh, { once: true });

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        pendingImages.forEach((image) => {
          image.removeEventListener("load", refresh);
          image.removeEventListener("error", refresh);
        });
        window.removeEventListener("load", refresh);
        master.kill();
      };
    },
    { scope: root, dependencies: [chapters] },
  );

  return (
    <JourneyContext.Provider value={{ active }}>
      <div
        ref={root}
        className="hero-landing relative bg-navy text-white"
        dir={dir}
        style={{ "--journey-progress": 0 } as CSSProperties}
      >
        {children}
      </div>
    </JourneyContext.Provider>
  );
}
