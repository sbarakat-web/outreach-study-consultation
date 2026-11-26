import { useEffect } from "react";
import { CHAPTERS } from "./chapters";
import { Scene } from "./Scene";
import { DreamScene } from "./dream/DreamScene";
import { HeroHeader } from "./HeroHeader";
import { JourneyOverlay } from "./JourneyOverlay";
import { JourneyProgress } from "./JourneyProgress";
import { useI18n } from "../../lib/i18n";

/**
 * /hero — cinematic "Study in Malta" landing page (in development, not indexed).
 * Journey: Dream → Travel → Malta → Study → Graduate → Career → Apply.
 *
 * Step 2: static layout. Layers, bottom to top: scenes (z-0) → journey overlay (z-30,
 * airplane / flight path / clouds, animated in Step 3) → progress (z-40) → header (z-50).
 */
export function HeroLanding() {
  const { lang } = useI18n();

  // Deep links (/hero#malta): the scenes render after load, so scroll once they exist.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <div className="hero-landing relative bg-navy text-white" dir={lang === "ar" ? "rtl" : "ltr"}>
      <HeroHeader />
      <JourneyProgress chapters={CHAPTERS} />
      <JourneyOverlay />
      <main>
        {CHAPTERS.map((c, i) =>
          c.id === "dream" ? (
            <DreamScene key={c.id} total={CHAPTERS.length} />
          ) : (
            <Scene key={c.id} chapter={c} index={i} total={CHAPTERS.length} />
          ),
        )}
      </main>
    </div>
  );
}
