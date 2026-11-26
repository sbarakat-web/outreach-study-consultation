import { QUALIFICATION_FRAMEWORKS, QUALIFICATION_LEVELS } from "./qualifications";

/**
 * Illustrative diploma (HTML/CSS, crisp at any size, no image request). It is clearly an
 * illustration ("Your future diploma", "Your name") — not a real certificate — and only names
 * qualification levels that exist in the programme data.
 */
export function Diploma() {
  return (
    <figure className="grad-diploma relative" aria-label="Illustration of your future diploma">
      <figcaption className="grad-diploma-cap mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/80">Your future diploma</figcaption>
      <div className="grad-paper relative overflow-hidden rounded-[6px] px-7 py-8 text-center shadow-2xl shadow-navy/50 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute inset-2 rounded-[3px] border border-[#c9a24a]/70" aria-hidden />
        <div className="pointer-events-none absolute inset-[13px] rounded-[2px] border border-[#c9a24a]/35" aria-hidden />
        <div className="grad-paper-inner relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#8a6d2b]">Study in Malta</p>
          <p className="grad-serif mt-3 text-4xl text-navy sm:text-5xl">Diploma</p>
          <p className="grad-serif mt-4 text-sm italic text-navy/70">This is to certify that</p>
          <p className="grad-serif mt-1 border-b border-navy/20 pb-1 text-2xl italic text-navy">Your name</p>
          <p className="grad-serif mt-3 text-sm italic text-navy/70">has successfully completed a programme of study in Malta</p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-navy/60">{QUALIFICATION_LEVELS.join(" · ")}</p>
          <div className="mt-6 flex items-end justify-between gap-4 text-start">
            <span className="block w-24 border-t border-navy/30 pt-1 text-[9px] uppercase tracking-[0.2em] text-navy/50">School</span>
            <span className="grad-seal relative grid h-14 w-14 shrink-0 place-items-center rounded-full" aria-hidden>
              <span className="grad-serif text-[10px] font-bold uppercase tracking-widest text-[#6b5320]">MT</span>
            </span>
            <span className="block w-24 border-t border-navy/30 pt-1 text-end text-[9px] uppercase tracking-[0.2em] text-navy/50">Date</span>
          </div>
        </div>
        <span className="grad-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12" aria-hidden />
      </div>
      <p className="grad-facts mt-4 text-xs leading-relaxed text-white/75">
        {QUALIFICATION_FRAMEWORKS.join(" · ")} qualifications with our partner schools. Recognition and award details are confirmed by each school.
      </p>
    </figure>
  );
}
