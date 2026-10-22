import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, FileText, MessageCircle, Search, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  BOOKING_LINK,
  CALL_STATUS_LABELS,
  ENGLISH_LEVELS,
  STATUSES,
  STUDY_PATHS,
  formatSlot,
  labelFor,
  leadScore,
  statusLabel,
  waLink,
} from "../../lib/options";
import type { Consultation, DocumentRow, Status } from "../../lib/types";
import { Alert, Button, Card, Spinner, StatusBadge } from "../../components/ui";

type Row = Consultation & { documents?: { count: number }[] };

const scoreOf = (c: Row) =>
  leadScore({ start_date: c.start_date, english_level: c.english_level, callRequested: c.call_status !== "none", documents: c.documents?.[0]?.count ?? 0 });

const TIER_STYLE = {
  hot: "bg-brand-red/10 text-brand-red",
  warm: "bg-amber-100 text-amber-800",
  cold: "bg-slate-100 text-slate-500",
};

function ScoreBadge({ c }: { c: Row }) {
  const { score, tier } = scoreOf(c);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold capitalize ${TIER_STYLE[tier]}`}>
      {tier === "hot" ? "🔥 " : ""}
      {tier} · {score}
    </span>
  );
}

export function Requests() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [sort, setSort] = useState<"score" | "newest">("score");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*, documents(count)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) setError(error.message);
    setItems((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (items ?? []).filter(
      (c) =>
        (!status || c.status === status) &&
        (!q || [c.full_name, c.email, c.whatsapp, c.country, c.desired_course].some((v) => v?.toLowerCase().includes(q))),
    );
    // Hot leads first; closed/lost leads sink to the bottom. Ties: newest first.
    if (sort === "score") {
      const rank = (c: Row) => (c.status === "lost" || c.status === "enrolled" ? -1 : scoreOf(c).score);
      rows.sort((a, b) => rank(b) - rank(a) || b.created_at.localeCompare(a.created_at));
    }
    return rows;
  }, [items, query, status, sort]);

  const upcoming = useMemo(
    () =>
      (items ?? [])
        .filter((c) => c.call_status !== "none" && c.preferred_call_at && new Date(c.preferred_call_at) > new Date())
        .sort((a, b) => a.preferred_call_at!.localeCompare(b.preferred_call_at!))
        .slice(0, 8),
    [items],
  );

  if (!items) return <Spinner />;
  const open = items.find((c) => c.id === openId);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      {upcoming.length > 0 && (
        <Card>
          <div className="px-5 py-5 sm:px-7">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-500">Upcoming calls</h2>
            <ul className="divide-y divide-slate-100">
              {upcoming.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:text-brand-blue">
                    <CalendarCheck className="h-4 w-4 shrink-0 text-brand-blue" />
                    <span className="w-44 shrink-0 font-bold">{formatSlot(c.preferred_call_at!)}</span>
                    <span className="truncate">{c.full_name}</span>
                    <CallBadge status={c.call_status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field pl-10"
            placeholder="Search name, email, phone, country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search requests"
          />
        </div>
        <select className="field sm:w-48" value={sort} onChange={(e) => setSort(e.target.value as "score" | "newest")} aria-label="Sort">
          <option value="score">Hot leads first</option>
          <option value="newest">Newest first</option>
        </select>
        <select className="field sm:w-64" value={status} onChange={(e) => setStatus(e.target.value as Status | "")} aria-label="Filter by status">
          <option value="">All statuses ({items.length})</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} ({items.filter((c) => c.status === s.value).length})
            </option>
          ))}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">No requests match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 font-bold">Candidate</th>
                  <th className="px-3 py-3 font-bold">Lead</th>
                  <th className="hidden px-3 py-3 font-bold md:table-cell">Course</th>
                  <th className="hidden px-3 py-3 font-bold sm:table-cell">Call</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="hidden px-5 py-3 font-bold lg:table-cell">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-mist">
                    <td className="px-5 py-3">
                      <button className="text-left font-bold hover:text-brand-blue" onClick={() => setOpenId(c.id)}>
                        {c.full_name}
                      </button>
                      <div className="text-xs text-slate-500">{c.country ?? c.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <ScoreBadge c={c} />
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">{c.desired_course || labelFor(STUDY_PATHS, c.study_path)}</td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      {c.preferred_call_at ? (
                        <div className="space-y-1">
                          <div>{formatSlot(c.preferred_call_at)}</div>
                          <CallBadge status={c.call_status} />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label={statusLabel(c.status)} muted={c.status === "lost"} />
                    </td>
                    <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && <Detail c={open as Row} onClose={() => setOpenId(null)} onSaved={load} />}
    </div>
  );
}

function CallBadge({ status }: { status: Row["call_status"] }) {
  if (status === "none") return null;
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        status === "confirmed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {status === "confirmed" ? "Confirmed" : "Requested"}
    </span>
  );
}

// datetime-local value in the admin's own time zone
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Detail({ c, onClose, onSaved }: { c: Row; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<Status>(c.status);
  const [notes, setNotes] = useState(c.admin_notes ?? "");
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [callAt, setCallAt] = useState(toLocalInput(c.preferred_call_at));

  useEffect(() => {
    supabase
      .from("documents")
      .select("*")
      .eq("consultation_id", c.id)
      .order("created_at")
      .then(({ data }) => setDocs(data ?? []));
  }, [c.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("consultations").update({ status, admin_notes: notes || null }).eq("id", c.id);
    setSaving(false);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "success", text: "Saved." });
    if (!error) onSaved();
  };

  const setCall = async (call_status: Row["call_status"]) => {
    if (call_status === "confirmed" && !callAt) return setMsg({ tone: "error", text: "Set the confirmed date and time first." });
    const { error } = await supabase
      .from("consultations")
      .update({
        call_status,
        preferred_call_at: callAt ? new Date(callAt).toISOString() : null,
        ...(call_status === "confirmed" && ["new", "contacted", "qualified"].includes(c.status) ? { status: "consultation_booked" } : {}),
      })
      .eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: call_status === "confirmed" ? "Call confirmed — the candidate now sees it in their dashboard." : "Call updated." });
    onSaved();
  };

  const first = c.full_name.split(" ")[0];
  const course = c.desired_course || "your studies";
  const bookingMessage = `Hi ${first}, this is Outreach. Thank you for your application for ${course} — we've reviewed your profile and would love to talk.${
    c.preferred_call_at ? ` You asked for ${formatSlot(c.preferred_call_at, { weekday: "long", month: "long", timeZone: "Europe/Malta" })} (Malta time).` : ""
  } Please confirm your free call here: ${BOOKING_LINK}`;

  const remove = async () => {
    if (!confirm(`Delete the request from ${c.full_name}? This can't be undone.`)) return;
    const { error } = await supabase.from("consultations").delete().eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    onClose();
    onSaved();
  };

  const openDoc = async (d: DocumentRow) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  };

  const lead = scoreOf(c);
  const rows: [string, string | null | undefined][] = [
    ["Lead score", `${lead.score} (${lead.tier})${lead.parts.length ? " — " + lead.parts.map(([l, n]) => `${l} +${n}`).join(", ") : ""}`],
    ["Email", c.email],
    ["WhatsApp", c.whatsapp],
    ["Country", c.country],
    ["Age", c.age?.toString()],
    ["Path", labelFor(STUDY_PATHS, c.study_path)],
    ["English level", labelFor(ENGLISH_LEVELS, c.english_level)],
    ["Course", c.desired_course],
    ["Start", c.start_date],
    ["Budget", c.budget],
    ["Visa support", c.visa_support],
    ["Contact time", c.preferred_contact_time],
    ["Message", c.message],
    ["Source", [c.tracking.utm_source, c.tracking.utm_medium, c.tracking.utm_campaign].filter(Boolean).join(" / ") || c.tracking.referrer],
    ["Received", new Date(c.created_at).toLocaleString()],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <h2 id="detail-title" className="text-xl font-black">
              {c.full_name}
            </h2>
            <p className="text-sm text-slate-500">{c.user_id ? "Has an account" : "No linked account yet"}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-navy/5 hover:bg-navy/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {c.whatsapp && (
              <a href={waLink(c.whatsapp, `Hi ${c.full_name.split(" ")[0]}, this is Outreach about your application for ${c.desired_course || "your studies"}.`)} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            )}
            <a href={`mailto:${c.email}`}>
              <Button variant="secondary">Email</Button>
            </a>
          </div>

          <div className="space-y-3 rounded-2xl bg-mist px-4 py-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-extrabold">
                <CalendarCheck className="h-4 w-4 text-brand-blue" /> Call
              </span>
              <span className="text-xs font-bold text-slate-500">{CALL_STATUS_LABELS[c.call_status]}</span>
            </div>
            {c.preferred_call_at && c.call_status === "requested" && (
              <p>
                Candidate asked for <strong>{formatSlot(c.preferred_call_at, { weekday: "long", month: "long" })}</strong>
              </p>
            )}
            <div>
              <label className="label" htmlFor="call-at">
                {c.call_status === "confirmed" ? "Confirmed time" : "Time to confirm"}
              </label>
              <input id="call-at" type="datetime-local" className="field" value={callAt} onChange={(e) => setCallAt(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {c.whatsapp && (
                <a href={waLink(c.whatsapp, bookingMessage)} target="_blank" rel="noreferrer">
                  <Button variant="secondary">
                    <MessageCircle className="h-4 w-4" /> Send booking link
                  </Button>
                </a>
              )}
              {c.call_status === "confirmed" ? (
                <Button variant="ghost" onClick={() => setCall(c.preferred_call_at ? "requested" : "none")}>
                  Undo confirmation
                </Button>
              ) : (
                <Button onClick={() => setCall("confirmed")}>Mark as confirmed</Button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              The booking link ({BOOKING_LINK.replace("https://", "")}) is only shared from here. Candidates see the call as confirmed once you mark it.
            </p>
          </div>

          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="whitespace-pre-wrap break-words font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-extrabold">Documents</h3>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded.</p>
            ) : (
              <ul className="space-y-1">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button onClick={() => openDoc(d)} className="flex items-center gap-2 text-sm hover:underline">
                      <FileText className="h-4 w-4 text-slate-400" /> {d.file_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select id="status" className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="notes">
                Internal notes
              </label>
              <textarea id="notes" rows={5} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <div className="flex justify-between gap-3">
              <Button variant="danger" onClick={remove}>
                Delete
              </Button>
              <Button onClick={save} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
