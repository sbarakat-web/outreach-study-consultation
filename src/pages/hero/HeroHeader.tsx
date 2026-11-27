import { Link } from "react-router-dom";

/** Minimal, transparent header over the scenes. */
export function HeroHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-navy/70 to-transparent pt-[env(safe-area-inset-top)]">
      <div className="hero-container flex h-16 items-center justify-between sm:h-20">
        <Link to="/" aria-label="Outreach — home" className="shrink-0">
          <img src="/logo.png" alt="Outreach — Study in Malta" width={1102} height={180} className="h-7 w-auto brightness-0 invert sm:h-9" />
        </Link>
        <a
          href="/#apply"
          className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-bold text-navy transition hover:bg-white/90 sm:px-5"
        >
          Free consultation
        </a>
      </div>
    </header>
  );
}
