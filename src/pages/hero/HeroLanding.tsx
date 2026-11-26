import { Link } from "react-router-dom";
import { CHAPTERS } from "./chapters";
import { useI18n } from "../../lib/i18n";

/**
 * /hero — cinematic "Study in Malta" landing page (in development).
 * Journey: Dream → Travel → Malta → Study → Graduate → Career.
 *
 * Foundation only: full-bleed page outside the site Layout, one full-viewport section per
 * chapter, a minimal header and a closing CTA. No animation or section design yet.
 * Assets for this page go in /public/hero/. Not indexed (not listed in SeoController).
 */
export function HeroLanding() {
  const { lang } = useI18n();

  return (
    <div className="hero-landing relative min-h-[100svh] bg-navy text-white" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
        <div className="hero-container flex h-16 items-center justify-between sm:h-20">
          <Link to="/" aria-label="Outreach — home" className="shrink-0">
            <img
              src="/logo.png"
              alt="Outreach — Study in Malta"
              width={1102}
              height={180}
              className="h-7 w-auto brightness-0 invert sm:h-9"
            />
          </Link>
          <Link
            to="/"
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand/90 sm:px-5 sm:py-2.5"
          >
            Free consultation
          </Link>
        </div>
      </header>

      <main>
        {CHAPTERS.map((c, i) => (
          <section
            key={c.id}
            id={c.id}
            data-chapter={c.id}
            aria-label={c.label}
            className="hero-scene relative flex items-center justify-center overflow-hidden"
          >
            {/* Placeholder — replaced by the scene in later steps. */}
            <div className="hero-container text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                {String(i + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-4xl font-extrabold sm:text-6xl lg:text-7xl">{c.label}</h2>
            </div>
          </section>
        ))}

        <section id="start" className="hero-container py-20 text-center sm:py-28">
          <Link
            to="/"
            className="inline-block rounded-full bg-brand px-7 py-3.5 text-base font-bold text-white transition hover:bg-brand/90"
          >
            Start your free consultation
          </Link>
        </section>
      </main>
    </div>
  );
}
