import type { Chapter } from "./chapters";

/**
 * Full-bleed background for a scene: a real photo (with a portrait source for phones),
 * or a clearly labelled placeholder until the photography is delivered.
 * Top/bottom fades blend each scene into the next, so the page reads as one continuous strip.
 */
export function SceneBackground({ chapter, priority }: { chapter: Chapter; priority?: boolean }) {
  const { image, placeholder } = chapter;

  return (
    <div className="absolute inset-0 -z-10" aria-hidden={!image}>
      {image ? (
        <picture>
          {image.mobile && <source media="(max-width: 767px)" srcSet={image.mobile} />}
          <img
            src={image.desktop}
            alt={image.alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="hero-photo h-full w-full object-cover"
            style={
              {
                "--pos-d": image.posDesktop ?? "50% 50%",
                "--pos-m": image.posMobile ?? image.posDesktop ?? "50% 50%",
              } as React.CSSProperties
            }
          />
        </picture>
      ) : placeholder ? (
        <div className={`relative h-full w-full bg-gradient-to-br ${placeholder.tint}`}>
          <div className="hero-placeholder-grain absolute inset-0 opacity-30" />
        </div>
      ) : null}

      {/* Readability + seamless blend between scenes. */}
      <div className={`hero-scrim hero-scrim--${chapter.align} absolute inset-0`} />
      <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-navy to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-navy to-transparent" />

      {placeholder && !image && (
        <div className="absolute inset-x-4 top-28 z-10 flex justify-center md:inset-x-auto md:end-24 md:top-auto md:bottom-8">
          <p className="max-w-sm rounded-lg border border-dashed border-amber-200/70 bg-black/45 px-3 py-2 text-[11px] leading-snug text-white/90 backdrop-blur-sm">
            <strong className="block text-[10px] uppercase tracking-[0.2em] text-amber-200">Photo placeholder</strong>
            {placeholder.brief}
            <span className="mt-1 block text-white/60">Desktop 2400×1350 · Phone 1080×1920 → /public/hero/{chapter.id}-*.webp</span>
          </p>
        </div>
      )}
    </div>
  );
}
