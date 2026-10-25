import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightCircle, BookOpen, CheckCircle2, ChevronDown, Download, ExternalLink, FileCheck2, Globe2, HelpCircle, MapPin, MessageCircle, ShieldCheck, Sparkles, Star, Users, X } from "lucide-react";
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
    <div className="grid overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm md:grid-cols-2">
      <div className="relative min-h-[320px] overflow-hidden bg-[#020617] md:min-h-[540px]">
        <SmartImage
          src={IMAGES.intro}
          alt="Outreach adviser meeting representatives from English Path and GBS Malta"
          className="absolute inset-0 h-full w-full object-cover object-center"
          fallback={
            <div className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#092553] via-[#5424c7] to-[#078bc7] p-8 text-center text-white md:min-h-[420px]">
              <img src="/logo.png" alt="" className="w-48 rounded-xl bg-white/95 p-3" />
              <p className="max-w-xs text-sm text-white/85">Advisers and partner schools working together for your Malta journey.</p>
            </div>
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061a3c]/55 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-white/25" />
        <p className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#092553] shadow-sm backdrop-blur">
          Outreach × education partners in Malta
        </p>
      </div>
      <div className="space-y-4 p-6 sm:p-8">
        <img src="/logo.png" alt="Outreach — Study in Malta" className="w-full max-w-[280px]" />
        {welcomeName && (
          <div className="rounded-2xl bg-violet-50 px-4 py-3 text-[#5424c7] ring-1 ring-violet-100">
            <p className="text-xs font-bold">Your personal Malta session</p>
            <p className="text-lg font-black">Welcome, {welcomeName}</p>
          </div>
        )}
        <Eyebrow>Outreach Recruitment Agency</Eyebrow>
        <h3 className="text-3xl font-black leading-tight text-[#092553] sm:text-4xl">Let’s build your Malta study plan</h3>
        <p className="text-base font-semibold leading-relaxed text-[#5424c7]">
          Compare programmes, understand fees and requirements, review the visa journey and identify your next best step.
        </p>
        <p className="border-t border-slate-200 pt-4 text-base leading-7 text-slate-600">
          {BRAND} makes every stage clear and personal—from your first course conversation through applications, documents and preparation for Malta.
        </p>
        <div className="space-y-2 border-t border-slate-200 pt-4">
          {[
            { icon: ShieldCheck, text: "Accredited education partners" },
            { icon: MessageCircle, text: "Personal application guidance" },
            { icon: ArrowRightCircle, text: "Support from course selection to arrival" },
          ].map((item) => (
            <p key={item.text} className="flex items-center gap-3 rounded-xl bg-sky-50 px-3 py-2.5 text-sm font-bold text-[#092553]">
              <item.icon className="h-4 w-4 shrink-0 text-[#078bc7]" aria-hidden="true" />
              {item.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Discover Malta

export function DiscoverChapter() {
  const motionFor = useCardMotion();
  const groups = [
    { question: "Why study in Malta?", cards: DISCOVER.slice(0, 2) },
    { question: "What is student life like?", cards: DISCOVER.slice(2, 4) },
    { question: "What opportunities are available?", cards: DISCOVER.slice(4, 6) },
  ];
  return (
    <div className="space-y-5">
      <div className="relative min-h-[280px] overflow-hidden rounded-2xl bg-[#092553] shadow-sm sm:min-h-[360px]">
        <SmartImage
          src={IMAGES.discover}
          alt="Valletta's limestone skyline and a traditional Maltese luzzu boat on the Mediterranean"
          className="absolute inset-0 h-full w-full object-cover"
          fallback={<div className="absolute inset-0 bg-gradient-to-br from-[#77c9f2] via-[#078bc7] to-[#092553]" />}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061a3c] via-[#092553]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-sky-200">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Malta, Mediterranean
          </p>
          <h3 className="max-w-2xl text-2xl font-black leading-tight sm:text-4xl">A small island with an international outlook</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
            Study in English while experiencing a connected European destination known for its coastline, history and welcoming student life.
          </p>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/70 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: MessageCircle, text: "English is an official language" },
          { icon: Globe2, text: "EU and Schengen member" },
          { icon: MapPin, text: "Mediterranean location" },
          { icon: Users, text: "International student community" },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-3 border-b border-sky-100 px-4 py-3 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0">
            <item.icon className="h-5 w-5 shrink-0 text-[#078bc7]" aria-hidden="true" />
            <p className="text-sm font-bold leading-snug text-[#092553]">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group, groupIndex) => (
          <section key={group.question} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-[#092553]">{group.question}</h3>
            <div className="mt-4 space-y-4">
              {group.cards.map((card, cardIndex) => (
                <motion.article key={card.title} {...motionFor(groupIndex * 2 + cardIndex)} className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#078bc7]">
                    <card.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h4 className="font-bold text-[#092553]">{card.title}</h4>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{card.text}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Note tone="sky">
        Malta combines English-language study with a European setting. Programme eligibility, living costs and work conditions vary, so your adviser
        will help you confirm the details for your personal plan.
      </Note>
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

const OTHER_INFO_TABS = [
  {
    title: "Work while studying",
    summary: "Understand the current guidance for combining eligible study with limited part-time work.",
    cards: OTHER_INFO[0].cards.filter((card) => card.title === "Part-time Work for Students"),
  },
  {
    title: "Career after graduation",
    summary: "Review the support and permissions that may apply after successfully completing your course.",
    cards: OTHER_INFO[0].cards.filter((card) => card.title !== "Part-time Work for Students"),
  },
  {
    title: "Payments and refunds",
    summary: "Check payment schedules, possible tax credits and the conditions attached to refund requests.",
    cards: OTHER_INFO[1].cards,
  },
  {
    title: "Important conditions",
    summary: "Keep official requirements, personal eligibility and current authority guidance at the centre of every decision.",
    cards: OTHER_INFO[2].cards,
  },
];

export function OtherInfoChapter() {
  const [activeTab, setActiveTab] = useState(0);
  const [openCard, setOpenCard] = useState<string | null>(OTHER_INFO_TABS[0].cards[0]?.title ?? null);
  const current = OTHER_INFO_TABS[activeTab];

  const chooseTab = (index: number) => {
    setActiveTab(index);
    setOpenCard(OTHER_INFO_TABS[index].cards[0]?.title ?? null);
  };

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Other information categories" className="mobile-scroll flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1.5">
        {OTHER_INFO_TABS.map((tab, index) => (
          <button
            key={tab.title}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            onClick={() => chooseTab(index)}
            className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[#5424c7] ${
              activeTab === index ? "bg-[#5424c7] text-white shadow-sm" : "text-slate-600 hover:bg-white"
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <motion.section key={current.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <Eyebrow>Essential guidance</Eyebrow>
        <h3 className="mt-1 text-2xl font-black text-[#092553]">{current.title}</h3>
        <p className="mt-2 text-base leading-7 text-slate-600">{current.summary}</p>
        <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
          {current.cards.map((card) => {
            const expanded = openCard === card.title;
            return (
              <article key={card.title}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenCard(expanded ? null : card.title)}
                  className="flex w-full items-center gap-3 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#5424c7] focus-visible:ring-inset"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-[#078bc7]">
                    <card.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 font-black text-[#092553]">{card.title}</span>
                  <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="pb-5 pl-[52px]">
                        <p className="text-base leading-7 text-slate-600">{card.text}</p>
                        {card.points && (
                          <ul className="mt-3 space-y-2">
                            {card.points.map((point) => (
                              <li key={point} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#078bc7]" aria-hidden="true" /> {point}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </motion.section>
      <Note>
        Important: this information is general guidance, not a guarantee. Rules, fees and eligibility can change and must be reconfirmed with the
        relevant school or authority before you proceed.
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

const CONFETTI = Array.from({ length: 18 }, (_, index) => ({
  left: `${6 + ((index * 17) % 88)}%`,
  delay: (index % 6) * 0.09,
  color: ["#5424c7", "#078bc7", "#f59e0b", "#10b981"][index % 4],
}));

export function ThankYouChapter({ celebrate = false }: { celebrate?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50 p-6 text-center shadow-sm sm:p-10">
      {celebrate && !reduce && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden="true">
          {CONFETTI.map((piece, index) => (
            <motion.span
              key={index}
              className="absolute top-0 h-3 w-2 rounded-sm"
              style={{ left: piece.left, backgroundColor: piece.color }}
              initial={{ y: -20, opacity: 0, rotate: 0 }}
              animate={{ y: 290, opacity: [0, 1, 1, 0], rotate: 420 }}
              transition={{ duration: 2.4, delay: piece.delay, ease: "easeOut" }}
            />
          ))}
        </div>
      )}
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg">
        <CheckCircle2 className="h-8 w-8" />
      </span>
      <p className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><Sparkles className="h-4 w-4" /> Session complete</p>
      <h3 className="mt-2 text-3xl font-black text-[#092553]">Your next steps are ready</h3>
      <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
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

