import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import type { Chapter } from "./chapters";
import { SceneBackground } from "./SceneBackground";
import { waLink, whatsappNumber } from "../../lib/options";

const ALIGN = {
  start: "items-end md:items-center md:justify-start md:text-start",
  end: "items-end md:items-center md:justify-end md:text-end",
  center: "items-end justify-center text-center md:items-center",
} as const;

/** One full-screen chapter of the journey: photo background + minimal, large typography. */
export function Scene({ chapter, index, total }: { chapter: Chapter; index: number; total: number }) {
  const [lead, ...rest] = chapter.title;
  const accent = rest.pop();
  const isCenter = chapter.align === "center";

  return (
    <section
      id={chapter.id}
      data-chapter={chapter.id}
      aria-labelledby={`${chapter.id}-title`}
      className="hero-scene relative isolate flex overflow-hidden"
    >
      <SceneBackground chapter={chapter} priority={index === 0} />

      <div className={`hero-container hero-scene-pad flex w-full ${ALIGN[chapter.align]}`}>
        <div className={`max-w-[38rem] lg:max-w-[48rem] ${isCenter ? "mx-auto" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/70 sm:text-sm">
            <span className="text-white">{String(index + 1).padStart(2, "0")}</span>
            <span className="mx-2 text-white/40">/ {String(total).padStart(2, "0")}</span>
            {chapter.label}
          </p>
          <h2 id={`${chapter.id}-title`} className="hero-title mt-4 font-extrabold text-white">
            {lead}
            {rest.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
            {accent && <span className="hero-accent block">{accent}</span>}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/80 sm:text-lg">{chapter.text}</p>

          {chapter.cta && (
            <div className={`mt-8 flex flex-col gap-3 sm:flex-row ${isCenter ? "sm:justify-center" : ""}`}>
              <Link
                to="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:bg-brand/90"
              >
                Start your free consultation
              </Link>
              {whatsappNumber && (
                <a
                  href={waLink(whatsappNumber, "Hi! I'd like to study in Malta.")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-7 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp us
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
