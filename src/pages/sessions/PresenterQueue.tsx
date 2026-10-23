import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CalendarDays, ChevronDown, ChevronRight, FileCheck2, Mail, MessageCircle, Play, Search, Star, Trash2, UserRound, Video, X } from "lucide-react";
import { ENGLISH_LEVELS, labelFor } from "../../lib/options";
import { AREAS, PROGRAMMES, findBestMatch } from "./data";
import type { Consultation } from "../../lib/types";

export type Candidate = Consultation;

const MIN = 60_000;

const atOf = (c: Candidate) => (c.preferred_call_at ? new Date(c.preferred_call_at) : null);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function countdown(at: Date, now: Date) {
  const diff = Math.round((at.getTime() - now.getTime()) / MIN);
  if (Math.abs(diff) < 1) return "now";
  const abs = Math.abs(diff);
  const span = abs < 60 ? `${abs} min` : diff > 0 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${Math.floor(abs / 60)}h`;
  return diff > 0 ? `in ${span}` : `${span} ago`;
}

export interface Buckets {
  today: Candidate[];
  upcoming: Candidate[];
  overdue: Candidate[];
}

/** Overdue = started more than 60 min ago; starred first, then by time (overdue newest first). */
export function bucketize(list: Candidate[], now: Date): Buckets {
  const star = (a: Candidate, b: Candidate) => Number(b.is_starred) - Number(a.is_starred);
  const time = (a: Candidate, b: Candidate) => (atOf(a)?.getTime() ?? Infinity) - (atOf(b)?.getTime() ?? Infinity);
  const b: Buckets = { today: [], upcoming: [], overdue: [] };
  for (const c of list) {
    const at = atOf(c);
    if (at && at.getTime() < now.getTime() - 60 * MIN) b.overdue.push(c);
    else if (!at || sameDay(at, now) || at < now) b.today.push(c);
    else b.upcoming.push(c);
  }
  b.today.sort((x, y) => star(x, y) || time(x, y));
  b.upcoming.sort((x, y) => star(x, y) || time(x, y));
  b.overdue.sort((x, y) => star(x, y) || -time(x, y));
  return b;
}

export const queueOrder = (b: Buckets) => [...b.today, ...b.upcoming, ...b.overdue];

function statusOf(c: Candidate, now: Date): { label: string; style: string } | null {
  const at = atOf(c);
  if (!at) return null;
  const late = (now.getTime() - at.getTime()) / MIN;
  if (late > 60) return { label: "Overdue", style: "bg-red-100 text-red-700" };
  if (late > 15) return { label: "Late", style: "bg-amber-100 text-amber-800" };
  if (late >= -15) return { label: "Due now", style: "bg-emerald-100 text-emerald-800" };
  return null;
}

const timeLabel = (c: Candidate, now: Date) => {
  const at = atOf(c);
  if (!at) return "No time set";
  const t = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay(at, now) ? t : `${at.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${t}`;
};

export interface DocProgress {
  done: number;
  total: number;
}

export function PresenterQueue({
  candidates: all,
  now,
  done,
  success,
  currentId,
  docs,
  programmeFor,
  onProgramme,
  onStart,
  onJoinAndStart,
  onHide,
}: {
  candidates: Candidate[];
  now: Date;
  done: number;
  success: string | null;
  currentId: string | null;
  docs: Record<string, DocProgress>;
  programmeFor: Record<string, string>;
  onProgramme: (id: string, programmeId: string) => void;
  onStart: (c: Candidate) => void;
  onJoinAndStart: (c: Candidate) => void;
  onHide: (c: Candidate) => void;
}) {
  const candidates = all;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const buckets = useMemo(() => bucketize(candidates, now), [candidates, now]);
  const order = queueOrder(buckets);
  const next = useMemo(
    () =>
      candidates
        .filter((c) => atOf(c) && atOf(c)!.getTime() >= now.getTime() - 60 * MIN)
        .sort((a, b) => atOf(a)!.getTime() - atOf(b)!.getTime())[0],
    [candidates, now],
  );
  const q = query.trim().toLowerCase();
  const results = q ? order.filter((c) => c.full_name.toLowerCase().includes(q) || c.email.includes(q)) : [];
  const position = currentId ? order.findIndex((c) => c.id === currentId) + 1 : 0;
  const nextCandidate = order[position] ?? order[0];
  const todayCount = candidates.filter((c) => atOf(c) && sameDay(atOf(c)!, now)).length;

  const groups: [string, Candidate[]][] = q
    ? [["Search results · whole queue", results]]
    : [
        ["Today", buckets.today],
        ["Upcoming", buckets.upcoming],
        ["Overdue", buckets.overdue],
      ];
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  return (
    <aside
      aria-label="Presenter queue"
      className="fixed inset-x-2 top-2 z-40 flex max-h-[58svh] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-[0_24px_70px_rgba(3,17,40,0.35)] backdrop-blur sm:inset-x-3 sm:top-3 md:inset-x-auto md:bottom-3 md:left-3 md:max-h-none md:w-96"
    >
      <div className="flex items-center gap-3 bg-[#092553] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Presenter mode</p>
          <h2 className="text-lg font-black">Interview queue</h2>
        </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {success && <p className="mb-5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">✓ {success}</p>}

        {next && (
          <section className="mb-3 space-y-3 rounded-2xl bg-gradient-to-br from-[#092553] to-[#5424c7] p-4 text-white shadow-lg">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-sky-200"><AlarmClock className="h-3.5 w-3.5" /> Next appointment · {countdown(atOf(next)!, now)}</p>
              <h3 className="mt-1 truncate text-xl font-black">{next.full_name}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-white/80">
                <span className="rounded-full bg-white/10 px-2 py-1"><CalendarDays className="mr-1 inline h-3 w-3" />{timeLabel(next, now)}</span>
                <span className="rounded-full bg-white/10 px-2 py-1"><FileCheck2 className="mr-1 inline h-3 w-3" />Docs {docs[next.id]?.done ?? 0}/{docs[next.id]?.total ?? "?"}</span>
                <span className="max-w-full truncate rounded-full bg-white/10 px-2 py-1">{PROGRAMMES.find((programme) => programme.id === (programmeFor[next.id] ?? findBestMatch(next.desired_course)?.id))?.course ?? next.desired_course ?? "Programme not selected"}</span>
              </div>
            </div>
            <button
              onClick={() => next.meeting_url ? onJoinAndStart(next) : onStart(next)}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 text-xs font-black text-white outline-none hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#5424c7]"
            >
              {next.meeting_url ? <Video className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              {next.meeting_url ? "Join meeting and start" : "Start presentation"}
            </button>
          </section>
        )}

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Today", todayCount, "text-[#092553]"],
            ["Done", done, "text-emerald-600"],
            ["Queue", candidates.length, "text-[#092553]"],
          ].map(([label, n, color]) => (
            <div key={label as string} className="rounded-xl bg-slate-50 py-2">
              <p className={`text-xl font-black ${color}`}>{n}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field py-2.5 pl-9 pr-9"
            placeholder="Search name or email"
            aria-label="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-3">
        {groups.map(([label, list]) => (
          <section key={label} className={`overflow-hidden rounded-2xl border bg-white ${label === "Overdue" && list.length ? "border-red-200" : "border-slate-200"}`}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}
              aria-expanded={!collapsed[label]}
              className={`flex w-full items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] ${label === "Overdue" && list.length ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500"}`}
            >
              {label} · {list.length}
              <ChevronDown className={`h-3.5 w-3.5 transition ${collapsed[label] ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed[label] && (
              <ul className="space-y-2 p-3">
                {list.length === 0 && <li className="px-1 text-xs text-slate-400">No candidates.</li>}
                {list.map((c) => (
                  <QueueRow
                    key={c.id}
                    c={c}
                    now={now}
                    active={currentId === c.id}
                    docs={docs[c.id]}
                    onDetails={() => setSelectedId(c.id)}
                    onStart={() => onStart(c)}
                    onJoinAndStart={() => onJoinAndStart(c)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span>
          {position} of {order.length}
        </span>
        <button
          disabled={!nextCandidate}
          onClick={() => nextCandidate && (nextCandidate.meeting_url ? onJoinAndStart(nextCandidate) : onStart(nextCandidate))}
          className="inline-flex items-center gap-1 rounded-full bg-[#092553] px-3 py-1.5 font-bold text-white outline-none hover:bg-[#153d77] focus-visible:ring-2 focus-visible:ring-[#5424c7] disabled:opacity-40"
        >
          Next candidate <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {selected && (
        <CandidateProfileDrawer
          c={selected}
          now={now}
          docs={docs[selected.id]}
          programmeId={programmeFor[selected.id] ?? findBestMatch(selected.desired_course)?.id ?? ""}
          onProgramme={(programmeId) => onProgramme(selected.id, programmeId)}
          onClose={() => setSelectedId(null)}
          onStart={() => onStart(selected)}
          onJoinAndStart={() => onJoinAndStart(selected)}
          onHide={() => {
            setSelectedId(null);
            onHide(selected);
          }}
        />
      )}
    </aside>
  );
}

function QueueRow({
  c,
  now,
  active,
  docs,
  onDetails,
  onStart,
  onJoinAndStart,
}: {
  c: Candidate;
  now: Date;
  active: boolean;
  docs?: DocProgress;
  onDetails: () => void;
  onStart: () => void;
  onJoinAndStart: () => void;
}) {
  const status = statusOf(c, now);

  return (
    <li className={`rounded-xl border bg-white p-2.5 ${active ? "border-[#5424c7]" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-black text-[#092553]">
            {c.is_starred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
            {c.full_name}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {timeLabel(c, now)}
            {status && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${status.style}`}>{status.label}</span>}
          </p>
        </div>
        <button onClick={onDetails} className="rounded-full px-2.5 py-1 text-[10px] font-black text-[#5424c7] outline-none hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-[#5424c7]">Profile</button>
      </div>

      {/* Pre-call brief */}
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
        <span className={`rounded-full px-1.5 py-0.5 ${docs && docs.done >= docs.total ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          Docs {docs?.done ?? 0}/{docs?.total ?? "?"}
        </span>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">{labelFor(ENGLISH_LEVELS, c.english_level)}</span>
        {c.start_date && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">{c.start_date}</span>}
      </div>
      {c.message && <p className="mt-1 line-clamp-2 text-xs text-slate-500">“{c.message}”</p>}

      <div className="mt-2 grid gap-1.5">
        <button
          onClick={c.meeting_url ? onJoinAndStart : onStart}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${c.meeting_url ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500" : "bg-[#5424c7] hover:bg-[#4319a8] focus-visible:ring-[#5424c7]"}`}
        >
          {c.meeting_url ? <Video className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          {c.meeting_url ? "Join meeting and start" : "Start presentation"}
        </button>
      </div>
    </li>
  );
}

function CandidateProfileDrawer({
  c,
  now,
  docs,
  programmeId,
  onProgramme,
  onClose,
  onStart,
  onJoinAndStart,
  onHide,
}: {
  c: Candidate;
  now: Date;
  docs?: DocProgress;
  programmeId: string;
  onProgramme: (programmeId: string) => void;
  onClose: () => void;
  onStart: () => void;
  onJoinAndStart: () => void;
  onHide: () => void;
}) {
  const digits = (c.whatsapp ?? "").replace(/\D/g, "");
  const at = atOf(c);
  const reminder = `Hi ${c.full_name.split(" ")[0]}, a quick reminder: your Outreach call is ${at ? `at ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "soon"}.${
    c.meeting_url ? ` Join here: ${c.meeting_url}` : " We'll call you on WhatsApp."
  }`;
  const facts: [string, string | null | undefined][] = [
    ["Appointment", c.preferred_call_at ? new Date(c.preferred_call_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : null],
    ["Email", c.email],
    ["WhatsApp", c.whatsapp],
    ["Country", c.country],
    ["Age", c.age?.toString()],
    ["English", labelFor(ENGLISH_LEVELS, c.english_level)],
    ["Preferred intake", c.start_date],
  ];
  const recommended = PROGRAMMES.find((programme) => programme.id === programmeId);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-[#031128]/45 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside aria-label={`${c.full_name} profile`} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#092553] px-5 py-4 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">Candidate profile</p>
            <h3 className="truncate text-xl font-black">{c.full_name}</h3>
            <p className="text-xs text-white/70">{timeLabel(c, now)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close candidate profile" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Document completion</p>
                <p className="text-2xl font-black text-[#092553]">{docs?.done ?? 0} of {docs?.total ?? "?"}</p>
              </div>
              <span className={`grid h-12 w-12 place-items-center rounded-full text-sm font-black ${docs && docs.done >= docs.total ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {docs?.total ? `${Math.round((docs.done / docs.total) * 100)}%` : "—"}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: docs?.total ? `${Math.round((docs.done / docs.total) * 100)}%` : "0%" }} /></div>
          </section>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Recommended programme</span>
            <select className="field mt-2 text-sm" value={programmeId} onChange={(event) => onProgramme(event.target.value)}>
              <option value="">Not selected</option>
              {AREAS.filter((area) => area.key !== "english").map((area) => (
                <optgroup key={area.key} label={area.name}>
                  {PROGRAMMES.filter((programme) => programme.area === area.key).map((programme) => (
                    <option key={programme.id} value={programme.id}>{programme.course} — {programme.school}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {recommended && <p className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-[#5424c7]">{recommended.school} · {recommended.duration} · {recommended.totalFee ?? recommended.fees[0]}</p>}
          </label>

          <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-2xl bg-slate-50 p-3 text-sm sm:grid-cols-[7rem_1fr] sm:p-4">
            {facts.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-slate-400">{key}</dt>
                <dd className="break-words font-semibold text-slate-700">{value || "—"}</dd>
              </div>
            ))}
          </dl>

          {c.message && <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Candidate note</p><p className="mt-1 text-sm text-slate-700">{c.message}</p></div>}

          {c.candidate_questions && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#5424c7]"><MessageCircle className="h-4 w-4" /> Questions for the consultation</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.candidate_questions}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {digits && (
              <>
                <a href={`https://web.whatsapp.com/send?phone=${digits}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                <a href={`https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800"><AlarmClock className="h-3.5 w-3.5" /> Reminder</a>
              </>
            )}
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"><Mail className="h-3.5 w-3.5" /> Email</a>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4">
          <button type="button" onClick={c.meeting_url ? onJoinAndStart : onStart} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700">
            {c.meeting_url ? <Video className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}{c.meeting_url ? "Join meeting and start" : "Start presentation"}
          </button>
          <button type="button" onClick={() => confirm(`Remove ${c.full_name} from the presenter queue? Their stage does not change.`) && onHide()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Remove from queue</button>
        </div>
      </aside>
    </div>
  );
}
