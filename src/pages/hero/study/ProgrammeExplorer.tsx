import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { HERO_PROGRAMMES, levelLabel, type HeroProgramme } from "./programmes";

/**
 * Interactive programme selection.
 *  - desktop (lg+): editorial numbered list on the left, a hairline journey divider, and a sticky
 *    detail panel on the right that follows hover / focus / click.
 *  - tablet & phones: the same list as touch-friendly rows that expand in place (one at a time).
 */
export function ProgrammeExplorer() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="prog-explorer relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.05fr)] lg:gap-14">
      <ol className="prog-list" aria-label="Academic programmes">
        {HERO_PROGRAMMES.map((p, i) => {
          const isActive = i === active;
          const isOpen = open === i;
          return (
            <li key={p.key} className="prog-row border-b border-white/10">
              {/* Desktop row: selects the panel */}
              <button
                type="button"
                className={`prog-btn group hidden w-full items-baseline gap-5 py-5 text-start transition-colors lg:flex ${isActive ? "text-white" : "text-white/45 hover:text-white/80"}`}
                aria-pressed={isActive}
                aria-controls="prog-panel"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <span className="w-8 shrink-0 text-xs font-bold tabular-nums tracking-widest text-white/40">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="prog-name block text-[clamp(1.6rem,2.6vw,2.4rem)] font-extrabold leading-tight tracking-tight">{p.name}</span>
                  <span className={`mt-1 block text-sm transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70"}`}>{meta(p)}</span>
                </span>
                <ArrowRight className={`h-6 w-6 shrink-0 transition-all duration-300 rtl:rotate-180 ${isActive ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`} aria-hidden />
              </button>

              {/* Tablet / phone row: expands in place */}
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-4 py-4 text-start lg:hidden"
                aria-expanded={isOpen}
                aria-controls={`prog-${p.key}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="w-7 shrink-0 text-xs font-bold tabular-nums tracking-widest text-white/40">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="block text-xl font-extrabold leading-tight text-white sm:text-2xl">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-white/60 sm:text-sm">{meta(p)}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-white/70 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              <div id={`prog-${p.key}`} className={`prog-acc grid transition-[grid-template-rows] duration-300 ease-out lg:hidden ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="pb-6">{isOpen && <Details p={p} compact />}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Journey divider (the Study journey line runs through here on desktop) */}
      <span className="prog-divider hidden bg-white/10 lg:block" aria-hidden />

      <div id="prog-panel" className="prog-panel hidden lg:block" aria-live="polite">
        <div className="sticky top-28">
          <Details key={HERO_PROGRAMMES[active].key} p={HERO_PROGRAMMES[active]} />
        </div>
      </div>
    </div>
  );
}

const meta = (p: HeroProgramme) =>
  [p.levels.length ? p.levels.map(levelLabel).join(" · ") : "General · Academic · Business", `${p.count} option${p.count > 1 ? "s" : ""}`].join("  —  ");

function Details({ p, compact }: { p: HeroProgramme; compact?: boolean }) {
  return (
    <div className="prog-details step-in">
      {!compact && (
        <div className="relative mb-6 aspect-[21/9] overflow-hidden rounded-2xl">
          <img src={p.campus.src} alt={p.campus.alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-transparent" />
        </div>
      )}

      <ul className={compact ? "space-y-3" : "mt-6 space-y-3"} aria-label={`${p.name} courses`}>
        {p.examples.slice(0, compact ? 3 : 4).map((e) => (
          <li key={e.course + e.school} className="prog-example border-s-2 border-brand/70 ps-4">
            <p className="font-bold leading-snug text-white">{e.course}</p>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          to={p.apply}
          className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand px-6 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand/90"
        >
          Discover Your Programme
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
