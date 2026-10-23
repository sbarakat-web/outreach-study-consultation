import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightCircle, BookOpen, CheckCircle2, Download, ExternalLink, FileCheck2, HelpCircle, MapPin, MessageCircle, ShieldCheck, Star, X } from "lucide-react";
import {
  AREAS,
  BRAND,
  DISCOVER,
  ENGLISH_PROVIDERS,
  IMAGES,
  LEVEL_STYLE,
  OTHER_INFO,
  PARTNERS,
  PROGRAMMES,
  SCHOLARSHIPS,
  SCHOOL_LOGOS,
  VISA_STEPS,
  type InfoCard,
  type Level,
  type Programme,
} from "./data";
import { SmartImage } from "./art";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["of", "&", "and"].includes(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");

function LogoTile({ src, name, className = "" }: { src?: string; name: string; className?: string }) {
  const fallback = (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#092553] to-[#5424c7] text-sm font-black tracking-wider text-white">
      {initials(name)}
    </span>
  );
  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      {src ? <SmartImage src={src} alt={name} className="h-full w-full object-contain p-1.5" fallback={fallback} /> : fallback}
    </span>
  );
}

function Note({ tone = "amber", children }: { tone?: "amber" | "sky" | "rose"; children: ReactNode }) {
  const style = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];
  return <p className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${style}`}>{children}</p>;
}

export const Eyebrow = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`text-[10px] font-black uppercase tracking-[0.18em] text-[#078bc7] ${className}`}>{children}</p>
);

function useCardMotion() {
  const reduce = useReducedMotion();
  return (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0.15 : 0.35, delay: reduce ? 0 : i * 0.06 },
    whileHover: reduce ? undefined : { y: -3 },
  });
}

// ---------------------------------------------------------------- 1. Introduction

export function IntroChapter({ welcomeName }: { welcomeName?: string }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border-2 border-sky-100 bg-white shadow-sm md:grid-cols-2">
      <div className="flex items-center justify-center bg-[#020617]">
        <SmartImage
          src={IMAGES.intro}
          alt="Our adviser with partner school representatives"
          className="max-h-[520px] w-full object-contain"
          fallback={
            <div className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#092553] via-[#5424c7] to-[#078bc7] p-8 text-center text-white md:min-h-[420px]">
              <img src="/logo.png" alt="" className="w-48 rounded-xl bg-white/95 p-3" />
              <p className="max-w-xs text-sm text-white/85">Advisers and partner schools working together for your Malta journey.</p>
            </div>
          }
        />
      </div>
      <div className="space-y-4 p-6 sm:p-8">
        <img src="/logo.png" alt="Outreach — Study in Malta" className="w-full max-w-[280px]" />
        {welcomeName && (
          <div className="rounded-xl bg-gradient-to-r from-[#5424c7] to-[#078bc7] px-4 py-3 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">Your personal Malta session</p>
            <p className="text-lg font-black">Welcome, {welcomeName}</p>
          </div>
        )}
        <Eyebrow>Outreach Recruitment Agency</Eyebrow>
        <h3 className="text-3xl font-black leading-tight text-[#092553] sm:text-4xl">
          STUDY and eventually WORK in MALTA
        </h3>
        <p className="font-bold text-[#5424c7]">
          All you need to know about study programs in Malta at accredited institutions and the processes to work while studying.
        </p>
        <p className="border-t border-slate-200 pt-4 text-slate-600">
          {BRAND} guides international students from their first course conversation through programme selection, school applications, document
          preparation and the Malta study journey. We make each step clear, personal and manageable.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Discover Malta

export function DiscoverChapter() {
  const motionFor = useCardMotion();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DISCOVER.map((card, i) => (
        <motion.article key={card.title} {...motionFor(i)} className="overflow-hidden rounded-2xl border-2 border-slate-100 bg-white shadow-sm">
          <div className="relative h-28 sm:h-32">
            <SmartImage
              src={card.image!}
              alt=""
              className="h-full w-full object-cover"
              fallback={<div className="h-full w-full bg-gradient-to-br from-[#77c9f2] via-[#078bc7] to-[#092553]" />}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#092553]/80 via-[#092553]/10 to-transparent" />
            <span className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-xl bg-white text-[#078bc7] shadow">
              <card.icon className="h-5 w-5" />
            </span>
          </div>
          <div className="p-4">
            <h4 className="font-black text-[#092553]">{card.title}</h4>
            <p className="text-sm text-slate-600">{card.text}</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 3. Programmes

const handleRowKey = (e: KeyboardEvent, fn: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

export function ProgrammesChapter({
  area,
  setArea,
  selectedId,
  setSelectedId,
  bestMatchId,
  liked,
  onToggleLike,
}: {
  area: string;
  setArea: (a: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  bestMatchId?: string;
  liked: Set<string>;
  onToggleLike: (id: string) => void;
}) {
  const current = AREAS.find((a) => a.key === area)!;
  const programmes = PROGRAMMES.filter((p) => p.area === area);
  const selected = PROGRAMMES.find((p) => p.id === selectedId && p.area === area);

  const chooseArea = (key: string) => {
    setArea(key);
    const first = PROGRAMMES.find((p) => p.area === key);
    if (first) setSelectedId(first.id);
  };

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Study areas" className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1.5">
        {AREAS.map((a) => {
          const active = a.key === area;
          return (
            <button
              key={a.key}
              role="tab"
              aria-selected={active}
              onClick={() => chooseArea(a.key)}
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-[#5424c7] ${
                active ? "bg-white text-[#5424c7] shadow" : "text-slate-600 hover:text-[#092553]"
              }`}
            >
              <a.icon className="h-4 w-4" />
              <span className="sm:hidden">{a.short}</span>
              <span className="hidden sm:inline">{a.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-black text-[#092553]">{current.name}</h3>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-[#078bc7]">
          {area === "english" ? `${ENGLISH_PROVIDERS.length} providers` : `${programmes.length} programmes`}
        </span>
      </div>

      {area === "english" ? (
        <EnglishProviders />
      ) : (
        <>
          {(["diploma", "bachelor", "master"] as Level[]).map((level) => {
            const rows = programmes.filter((p) => p.level === level);
            if (!rows.length) return null;
            return (
              <LevelTable
                key={level}
                areaName={current.name}
                level={level}
                rows={rows}
                selectedId={selectedId}
                bestMatchId={bestMatchId}
                liked={liked}
                onToggleLike={onToggleLike}
                onSelect={setSelectedId}
                notes={SCHOLARSHIPS[area]?.[level] ?? []}
              />
            );
          })}
          <Note>
            Fees and scholarships are based on the supplied documents and should be reconfirmed before enrolment. Select a row to use that programme
            for the candidate session.
          </Note>
          <ProgrammeDetails programme={selected} />
        </>
      )}
    </div>
  );
}

function LevelTable({
  areaName,
  level,
  rows,
  selectedId,
  bestMatchId,
  liked,
  onToggleLike,
  onSelect,
  notes,
}: {
  areaName: string;
  level: Level;
  rows: Programme[];
  selectedId: string | null;
  bestMatchId?: string;
  liked: Set<string>;
  onToggleLike: (id: string) => void;
  onSelect: (id: string) => void;
  notes: string[];
}) {
  const style = LEVEL_STYLE[level];
  const years = level === "bachelor" ? 3 : 2;
  return (
    <section className={`overflow-hidden rounded-2xl border-2 bg-white ${style.border}`}>
      <div className="px-5 py-3 text-white" style={{ background: style.color }}>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">{areaName}</p>
        <h4 className="text-lg font-black">{style.label}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-white" style={{ background: style.color }}>
            <tr>
              {["School", "Course", "Qualification", "Duration", "Year 1", "Year 2", ...(years === 3 ? ["Year 3"] : [])].map((h) => (
                <th key={h} className="px-4 py-2 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const selected = p.id === selectedId;
              return (
                <tr
                  key={p.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(p.id)}
                  onKeyDown={(e) => handleRowKey(e, () => onSelect(p.id))}
                  className={`cursor-pointer outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5424c7] ${
                    selected ? style.selected : i % 2 ? "bg-slate-50" : "bg-white"
                  } hover:bg-slate-100`}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <LogoTile src={SCHOOL_LOGOS[p.school]} name={p.school} className="h-14 w-20 shrink-0" />
                      <span className="font-semibold text-[#092553]">{p.school}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-label={liked.has(p.id) ? `Unmark ${p.course}` : `Mark ${p.course} as liked`}
                        aria-pressed={liked.has(p.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(p.id);
                        }}
                        className="mt-0.5 shrink-0 rounded-full p-0.5 outline-none hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Star className={`h-4 w-4 ${liked.has(p.id) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                      </button>
                      <span className="font-bold text-slate-800">{p.course}</span>
                    </span>
                    {p.id === bestMatchId && (
                      <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                        <Star className="h-3 w-3 fill-current" /> Best match
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.qualification}</td>
                  <td className="px-4 py-3 text-slate-600">{p.duration}</td>
                  {Array.from({ length: years }, (_, y) => (
                    <td key={y} className="px-4 py-3 font-black text-slate-900">
                      {p.fees[y] ?? "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {notes.length > 0 && (
        <div className={`space-y-1 border-t px-5 py-3 text-xs ${style.border} ${style.selected} ${style.text}`}>
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProgrammeDetails({ programme }: { programme?: Programme }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (programme) ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [programme, reduce]);

  return (
    <AnimatePresence initial={false} mode="wait">
      {programme ? (
        <motion.div
          key={programme.id}
          ref={ref}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.3 }}
          className="overflow-hidden"
        >
          <div className="space-y-4 rounded-2xl border-2 border-violet-100 bg-white p-5 shadow-sm">
            <div>
              <Eyebrow>Complete programme details</Eyebrow>
              <h4 className="mt-1 text-xl font-black text-[#092553]">{programme.course}</h4>
              <p className="text-sm text-slate-600">{programme.school}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {[
                ["Duration", programme.duration],
                ["Fee", programme.totalFee ?? "Confirm with school"],
                ["English", programme.english ?? "Confirm with school"],
                ["Requirement", programme.requirement ?? "School assessment"],
                ["Qualification", [programme.qualification, programme.credits].filter(Boolean).join(" · ")],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</p>
                  <p className="text-sm font-bold text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-800">
              Fees and entry requirements shown here are guidance only. Final admission, intake dates and any scholarship are confirmed by the school.
            </p>
          </div>
        </motion.div>
      ) : (
        <p className="text-sm text-slate-400">Select a programme card to reveal its details</p>
      )}
    </AnimatePresence>
  );
}

function EnglishProviders() {
  return (
    <div className="space-y-5">
      {ENGLISH_PROVIDERS.map((p) => (
        <section key={p.name} className="space-y-3 rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Eyebrow>{p.eyebrow}</Eyebrow>
              <h4 className="text-lg font-black text-[#092553]">{p.name}</h4>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-[#5424c7]">{p.pill}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-[#5424c7] text-white">
                <tr>
                  {p.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r, i) => (
                  <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                    {r.map((cell, j) => (
                      <td key={j} className={`whitespace-nowrap px-3 py-2 ${j < 2 ? "font-bold text-slate-800" : "text-slate-600"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.notes.map((n) => (
            <Note key={n.text} tone={n.tone}>
              {n.text}
            </Note>
          ))}
          {p.offer && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">Limited launch offer</p>
              <p className="mt-1 font-black">
                {p.offer.title} — <s className="font-semibold opacity-60">{p.offer.was}</s> {p.offer.now}
              </p>
              <p className="text-sm">{p.offer.detail}</p>
              <p className="text-sm">{p.offer.admission}</p>
            </div>
          )}
        </section>
      ))}
      <Note>
        Prices, schedules, availability and admission conditions are based on the supplied programme document and should be reconfirmed before
        enrolment.
      </Note>
    </div>
  );
}

// ---------------------------------------------------------------- 4 & 6. Checklist cards

function ChecklistCard({ card, index, number }: { card: InfoCard; index: number; number?: number }) {
  const motionFor = useCardMotion();
  return (
    <motion.article {...motionFor(index)} className="relative rounded-2xl border-2 border-slate-100 bg-white p-5 shadow-sm">
      {number && (
        <span className="pointer-events-none absolute right-4 top-3 text-4xl font-black text-slate-100" aria-hidden>
          {String(number).padStart(2, "0")}
        </span>
      )}
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-[#078bc7]">
        <card.icon className="h-5 w-5" />
      </span>
      <h4 className="mt-3 font-black text-[#092553]">{card.title}</h4>
      <p className="mt-1 text-sm text-slate-600">{card.text}</p>
      {card.points && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {card.points.map((pt) => (
            <li key={pt} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {pt}
            </li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}

export function VisaChapter() {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const checklistPath = "/documents/student-national-visa-checklist.pdf";
  const officialChecklistUrl = "https://identita.gov.mt/wp-content/uploads/2025/08/03a.-List-of-Required-Documents-Student_National_Visa.pdf";

  useEffect(() => {
    if (!checklistOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && setChecklistOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checklistOpen]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border-2 border-red-100 bg-gradient-to-r from-red-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-sm">
            <FileCheck2 className="h-6 w-6" />
          </span>
          <div>
            <Eyebrow className="text-red-600">Official Identità checklist</Eyebrow>
            <h3 className="mt-1 text-xl font-black text-[#092553]">Student National Visa documents</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Review the official two-page checklist for study visas longer than 90 days before preparing or submitting the application.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChecklistOpen(true)}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-extrabold text-white outline-none hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          <FileCheck2 className="h-4 w-4" /> View visa checklist
        </button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VISA_STEPS.map((c, i) => (
          <ChecklistCard key={c.title} card={c} index={i} number={i + 1} />
        ))}
      </div>

      <AnimatePresence>
        {checklistOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[#031128]/80 p-2 backdrop-blur-sm sm:p-5"
            role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && setChecklistOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="visa-checklist-title"
              className="flex h-[96svh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[92svh] sm:rounded-3xl"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">Identità · Central Visa Unit</p>
                  <h3 id="visa-checklist-title" className="truncate text-base font-black text-[#092553] sm:text-lg">Student National Visa checklist</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={checklistPath}
                    download="Identita-Student-National-Visa-Checklist.pdf"
                    className="hidden h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 sm:inline-flex"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                  <a
                    href={officialChecklistUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 sm:inline-flex"
                  >
                    Official source <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setChecklistOpen(false)}
                    aria-label="Close visa checklist"
                    className="grid h-10 w-10 place-items-center rounded-full bg-[#092553] text-white outline-none hover:bg-[#153d77] focus-visible:ring-2 focus-visible:ring-[#5424c7] focus-visible:ring-offset-2"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>
              <div className="min-h-0 flex-1 bg-slate-200">
                <iframe
                  src={`${checklistPath}#view=FitH&toolbar=1&navpanes=0`}
                  title="Identità student national visa required documents checklist"
                  className="h-full w-full border-0"
                />
              </div>
              <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500 sm:hidden">
                <a href={checklistPath} download="Identita-Student-National-Visa-Checklist.pdf" className="inline-flex items-center gap-1 font-bold text-[#092553]"><Download className="h-3.5 w-3.5" /> Download PDF</a>
                <a href={officialChecklistUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#092553]">Official source <ExternalLink className="h-3.5 w-3.5" /></a>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OtherInfoChapter() {
  return (
    <div className="space-y-5">
      {OTHER_INFO.map((section, s) => (
        <section key={section.title} className="space-y-4 rounded-2xl bg-slate-50 p-4 sm:p-5">
          <div>
            <Eyebrow>Section {s + 1}</Eyebrow>
            <h3 className="text-lg font-black text-[#092553]">{section.title}</h3>
            <p className="text-sm text-slate-600">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.cards.map((c, i) => (
              <ChecklistCard key={c.title} card={c} index={i} />
            ))}
          </div>
        </section>
      ))}
      <Note tone="sky">
        Conditions can vary by student, institution and current authority requirements. Your Outreach adviser will confirm what applies before you
        proceed.
      </Note>
    </div>
  );
}

// ---------------------------------------------------------------- 5. School partners

export function PartnersChapter() {
  const motionFor = useCardMotion();
  const [selected, setSelected] = useState<(typeof PARTNERS)[number] | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 p-5 sm:p-6">
        <Eyebrow>Our education network</Eyebrow>
        <h3 className="mt-1 text-2xl font-black text-[#092553]">Working with schools across Malta</h3>
        <p className="mt-2 max-w-3xl text-slate-600">
          {BRAND} works with multiple English-language, business and higher-education providers. This allows us to help students compare programmes
          and find an institution that fits their goals.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PARTNERS.map((p, i) => (
          <motion.button
            key={p.name}
            {...motionFor(i)}
            type="button"
            onClick={() => setSelected(p)}
            aria-label={`View ${p.name} profile`}
            className="group flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white p-4 text-center shadow-sm outline-none transition hover:border-sky-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#5424c7]"
          >
            <LogoTile src={p.logo} name={p.name} className="h-20 w-full max-w-[150px]" />
            <span className="text-sm font-black text-[#092553]">{p.name}</span>
            <span className="flex items-center gap-1 text-xs font-bold text-[#078bc7]">
              View school profile <ArrowRightCircle className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </motion.button>
        ))}
      </div>
      <Note>Available institutions and programmes depend on the student's profile, chosen intake and current admissions availability.</Note>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-[#031128]/70 p-3 backdrop-blur-sm sm:items-center"
            role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.article
              role="dialog"
              aria-modal="true"
              aria-labelledby="partner-profile-title"
              className="max-h-[92svh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
            >
              <div className="relative h-48 overflow-hidden rounded-t-3xl sm:h-64">
                <SmartImage
                  src={selected.campusImage}
                  alt={`${selected.name} learning environment`}
                  className="h-full w-full object-cover"
                  fallback={<div className="h-full bg-gradient-to-br from-[#092553] via-[#5424c7] to-[#078bc7]" />}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#031128]/85 via-transparent to-black/10" />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close school profile"
                  className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-slate-700 shadow outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#5424c7]"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute inset-x-5 bottom-5 flex items-end gap-4">
                  <LogoTile src={selected.logo} name={selected.name} className="h-20 w-32 shrink-0 bg-white shadow-lg sm:w-40" />
                  <div className="min-w-0 text-white">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">Education partner</p>
                    <h4 id="partner-profile-title" className="text-xl font-black leading-tight sm:text-2xl">{selected.name}</h4>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.25fr] sm:p-7">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-black text-[#092553]"><MapPin className="h-4 w-4 text-[#078bc7]" /> Location</p>
                    <p className="mt-1 text-sm text-slate-600">{selected.location}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-black text-[#092553]"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Recognition</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{selected.accreditation}</p>
                  </div>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-black text-[#092553]"><BookOpen className="h-4 w-4 text-[#5424c7]" /> Main study areas</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selected.programmes.map((programme) => (
                      <li key={programme} className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {programme}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`https://${selected.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#092553] px-5 py-3 text-sm font-extrabold text-white outline-none hover:bg-[#153d77] focus-visible:ring-2 focus-visible:ring-[#5424c7] focus-visible:ring-offset-2"
                  >
                    Visit official website <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <p className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500 sm:px-7">
                Institution and accreditation information is a concise guide. Confirm the current status and the selected programme in the official register before enrolment.
              </p>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------- 7. Thank you

export function ThankYouChapter() {
  return (
    <div className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-b from-white to-emerald-50 p-6 text-center sm:p-10">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg">
        <CheckCircle2 className="h-8 w-8" />
      </span>
      <h3 className="mt-4 text-3xl font-black text-[#092553]">Thank you for joining us</h3>
      <p className="mx-auto mt-3 max-w-2xl text-slate-600">
        We hope your programme, application steps and Malta study options are now clear. {BRAND} is ready to answer any remaining questions and
        guide you through the next step.
      </p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        {[
          { icon: HelpCircle, title: "Questions?", text: "Ask your adviser anything that is still unclear." },
          { icon: ArrowRightCircle, title: "Next step", text: "Confirm your programme and prepare the requested documents." },
          { icon: MessageCircle, title: "Stay connected", text: "Check your email, WhatsApp and candidate dashboard for updates." },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl bg-white p-4 shadow-sm">
            <c.icon className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 font-black text-[#092553]">{c.title}</p>
            <p className="text-sm text-slate-600">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

