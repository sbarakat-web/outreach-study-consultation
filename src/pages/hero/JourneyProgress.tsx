import type { Chapter } from "./chapters";
import { useJourneyState } from "./JourneyController";

/**
 * Journey progress: vertical rail with labels on tablet/desktop, compact bar + chapter name on phones.
 * Reads the shared GSAP journey controller, so pinned scenes and the visible chapter stay aligned.
 */
export function JourneyProgress({ chapters }: { chapters: Chapter[] }) {
  const { active } = useJourneyState();

  const pct = chapters.length > 1 ? (active / (chapters.length - 1)) * 100 : 0;

  return (
    <>
      {/* Tablet / desktop: right-hand rail. */}
      <nav aria-label="Journey" className="fixed end-4 top-1/2 z-40 hidden -translate-y-1/2 md:block lg:end-8">
        <div className="relative">
          <div className="absolute end-[7px] top-2 bottom-2 w-px bg-white/20" />
          <div className="absolute end-[7px] top-2 w-px bg-white transition-all duration-500" style={{ height: `calc(${pct}% - ${pct / 100}rem)` }} />
          <ol className="relative space-y-5">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="group flex items-center justify-end gap-3" aria-current={i === active ? "step" : undefined}>
                  <span
                    className={`hidden text-xs font-bold uppercase tracking-[0.2em] transition xl:inline ${
                      i === active ? "text-white" : "text-white/0 group-hover:text-white/70"
                    }`}
                  >
                    {c.label}
                  </span>
                  <span
                    className={`h-[15px] w-[15px] rounded-full border-2 transition ${
                      i === active ? "border-white bg-brand" : i < active ? "border-white bg-white" : "border-white/40 bg-navy/40"
                    }`}
                  />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Phone: slim bar under the header. */}
      <nav aria-label="Journey" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-40 md:hidden">
        <div className="h-0.5 bg-white/15">
          <div className="h-full bg-white transition-all duration-500" style={{ width: `${((active + 1) / chapters.length) * 100}%` }} />
        </div>
        <p className="hero-container mt-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
          {String(active + 1).padStart(2, "0")} · {chapters[active]?.label}
        </p>
      </nav>
    </>
  );
}
