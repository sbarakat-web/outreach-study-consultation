import { useMemo, useState } from "react";
import { AlarmClock, ChevronDown, ChevronRight, Mail, MessageCircle, Play, Search, Star, Trash2, UserRound, Video, X } from "lucide-react";
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
  const [tab, setTab] = useState<"queue" | "overdue">("queue");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

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
    : tab === "overdue"
      ? [["Overdue", buckets.overdue]]
      : [
          ["Today", buckets.today],
          ["Upcoming", buckets.upcoming],
        ];

  return (
    <aside
      aria-label="Presenter queue"
      className="fixed inset-x-3 top-3 z-40 flex max-h-[52svh] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-[0_24px_70px_rgba(3,17,40,0.35)] backdrop-blur md:inset-x-auto md:bottom-3 md:left-3 md:max-h-none md:w-80"
    >
      <div className="flex items-center gap-3 bg-[#092553] px-4 py-3 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Presenter mode</p>
          <h2 className="text-lg font-black">Interview queue</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">✓ {success}</p>}

        {next && (
          <button
            onClick={() => onStart(next)}
            className="flex w-full items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-left text-sm font-bold text-[#5424c7] outline-none ring-1 ring-violet-200 hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-[#5424c7]"
          >
            <AlarmClock className="h-4 w-4 shrink-0" />
            <span className="truncate">
              Next call {countdown(atOf(next)!, now)} — {next.full_name}
            </span>
          </button>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
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

        <div className="relative">
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

        {!q && buckets.overdue.length > 0 && (
          <div role="tablist" className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["queue", "overdue"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#5424c7] ${
                  tab === t ? "bg-white text-[#5424c7] shadow" : "text-slate-500"
                }`}
              >
                {t === "queue" ? "Queue" : `Overdue · ${buckets.overdue.length}`}
              </button>
            ))}
          </div>
        )}

        {groups.map(([label, list]) => (
          <section key={label}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}
              aria-expanded={!collapsed[label]}
              className="sticky top-0 z-10 flex w-full items-center justify-between bg-white/95 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 backdrop-blur"
            >
              {label} · {list.length}
              <ChevronDown className={`h-3.5 w-3.5 transition ${collapsed[label] ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed[label] && (
              <ul className="space-y-2">
                {list.length === 0 && <li className="px-1 text-xs text-slate-400">No candidates.</li>}
                {list.map((c) => (
                  <QueueRow
                    key={c.id}
                    c={c}
                    now={now}
                    open={expanded === c.id}
                    active={currentId === c.id}
                    docs={docs[c.id]}
                    programmeId={programmeFor[c.id] ?? findBestMatch(c.desired_course)?.id ?? ""}
                    onProgramme={(pid) => onProgramme(c.id, pid)}
                    onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                    onStart={() => onStart(c)}
                    onJoinAndStart={() => onJoinAndStart(c)}
                    onHide={() => onHide(c)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span>
          {position} of {order.length}
        </span>
        <button
          disabled={!nextCandidate}
          onClick={() => nextCandidate && onStart(nextCandidate)}
          className="inline-flex items-center gap-1 rounded-full bg-[#092553] px-3 py-1.5 font-bold text-white outline-none hover:bg-[#153d77] focus-visible:ring-2 focus-visible:ring-[#5424c7] disabled:opacity-40"
        >
          Next candidate <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function QueueRow({
  c,
  now,
  open,
  active,
  docs,
  programmeId,
  onProgramme,
  onToggle,
  onStart,
  onJoinAndStart,
  onHide,
}: {
  c: Candidate;
  now: Date;
  open: boolean;
  active: boolean;
  docs?: DocProgress;
  programmeId: string;
  onProgramme: (programmeId: string) => void;
  onToggle: () => void;
  onStart: () => void;
  onJoinAndStart: () => void;
  onHide: () => void;
}) {
  const status = statusOf(c, now);
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
    ["Date of birth", c.age ? `Age ${c.age}` : null],
    ["Destination", "Malta"],
  ];

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
        <button
          aria-label={open ? "Hide details" : "Show details"}
          aria-expanded={open}
          onClick={onToggle}
          className="rounded-full p-1 text-slate-400 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#5424c7]"
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
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
        {c.meeting_url && (
          <button
            onClick={onJoinAndStart}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-1.5 text-xs font-bold text-white outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <Video className="h-3.5 w-3.5" /> Join Meet + Start presentation
          </button>
        )}
        <button
          onClick={onStart}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#5424c7] py-1.5 text-xs font-bold text-white outline-none hover:bg-[#4319a8] focus-visible:ring-2 focus-visible:ring-[#5424c7] focus-visible:ring-offset-2"
        >
          <Play className="h-3.5 w-3.5 fill-current" /> Start presentation
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs">
          <label className="block">
            <span className="text-slate-400">Programme for this session</span>
            <select className="field mt-1 py-1.5 text-xs" value={programmeId} onChange={(e) => onProgramme(e.target.value)}>
              <option value="">Not selected</option>
              {AREAS.filter((a) => a.key !== "english").map((a) => (
                <optgroup key={a.key} label={a.name}>
                  {PROGRAMMES.filter((p) => p.area === a.key).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.course} — {p.school}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {c.meeting_url && (
              <a href={c.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 font-bold text-[#078bc7]">
                <Video className="h-3.5 w-3.5" /> Join Meet
              </a>
            )}
            {digits && (
              <>
                <a href={`https://web.whatsapp.com/send?phone=${digits}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a
                  href={`https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(reminder)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800"
                >
                  <AlarmClock className="h-3.5 w-3.5" /> Send reminder
                </a>
              </>
            )}
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
          </div>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-400">{k}</dt>
                <dd className="break-words font-semibold text-slate-700">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <button
            onClick={() => {
              if (confirm(`Remove ${c.full_name} from the presenter queue? Their stage does not change.`)) onHide();
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove from queue
          </button>
        </div>
      )}
    </li>
  );
}
