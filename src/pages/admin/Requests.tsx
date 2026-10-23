import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck, CheckCircle2, Clock, ExternalLink, FileText, Play, Plus, Presentation, Search, Star, UsersRound, Video, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  ENGLISH_LEVELS,
  documentTypesFor,
  STATUSES,
  STUDY_PATHS,
  formatSlot,
  labelFor,
  statusLabel,
  callStage,
  noReply24h,
} from "../../lib/options";
import { CallPanel } from "./CallPanel";
import { SessionPanel, sessionHref } from "./SessionPanel";
import type { Consultation, DocumentRow, Status } from "../../lib/types";
import { Alert, Button, Card, Spinner, StatusBadge } from "../../components/ui";
import { MeetingCard, PageTitle, StatStrip } from "../../components/dash";

type Row = Consultation & { documents?: { count: number }[] };


export function Requests() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const requestedStatus = params.get("status");
  const [status, setStatus] = useState<Status | "">(STATUSES.some((s) => s.value === requestedStatus) ? requestedStatus as Status : "");
  const [adding, setAdding] = useState(params.get("new") === "1");
  useEffect(() => {
    setQuery(params.get("q") ?? "");
    const next = params.get("status");
    setStatus(STATUSES.some((s) => s.value === next) ? next as Status : "");
    setAdding(params.get("new") === "1");
  }, [params]);
  const [openId, setOpenId] = useState<string | null>(params.get("lead"));
  const [view, setView] = useState(params.get("view"));

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
        (view !== "booked" || isBookedLead(c)) &&
        (!q || [c.full_name, c.email, c.whatsapp, c.country, c.desired_course].some((v) => v?.toLowerCase().includes(q))),
    );
    return rows;
  }, [items, query, status, view]);

  const upcoming = useMemo(
    () =>
      (items ?? [])
        .map((c) => ({ c, at: callTimeOf(c) }))
        .filter((x): x is { c: Row; at: string } => !!x.at && new Date(x.at) > new Date())
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, 8),
    [items],
  );

  if (!items) return <Spinner />;
  const open = items.find((c) => c.id === openId);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <PageTitle
        actions={
          <span className="flex flex-wrap gap-2">
            <Button onClick={() => setParams({ new: "1" })}>
              <Plus className="h-4 w-4" /> Add new lead
            </Button>
            <Link to="/onlinesessions?present=1">
              <Button variant="secondary">
                <Presentation className="h-4 w-4" /> Online sessions
              </Button>
            </Link>
          </span>
        }
      >
        Leads
      </PageTitle>

      <StatStrip
        items={[
          {
            icon: UsersRound,
            label: "Leads",
            value: items.length,
            sub: `+${items.filter((c) => new Date(c.created_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length} this month`,
            onClick: () => setView(null),
          },
          {
            icon: Clock,
            label: "To confirm",
            value: items.filter((c) => ["requested", "reviewed", "suggested"].includes(callStage(c))).length,
            sub: "call requests",
            tone: "text-amber-500",
          },
          { icon: CalendarCheck, label: "Booked calls", value: items.filter(isBookedLead).length, sub: "confirmed", tone: "text-brand", onClick: () => setView("booked") },
          { icon: CheckCircle2, label: "Interviewed", value: items.filter((c) => c.session_outcome === "interviewed").length, sub: "online sessions", tone: "text-emerald-600" },
        ]}
      />

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[15px] text-navy">Upcoming · {upcoming.length} calls</h2>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map(({ c, at }) => (
              <MeetingCard
                key={c.id}
                name={c.full_name}
                title={c.full_name}
                subtitle={c.email}
                time={formatSlot(at)}
                status={
                  <>
                    <span className="truncate text-brand">{c.desired_course || labelFor(STUDY_PATHS, c.study_path)}</span>
                    <CallBadge c={c} />
                  </>
                }
                footer={
                  <>
                    <button onClick={() => setOpenId(c.id)} className="hover:bg-slate-50 hover:text-brand">
                      View details
                    </button>
                    {isBookedLead(c) && (
                      <Link to={sessionHref(c)} className="font-bold text-brand hover:bg-brand/5">
                        Start session
                      </Link>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === "booked" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-bold text-brand">
            Booked appointments only
            <button aria-label="Show all leads" onClick={() => setView(null)} className="rounded-full px-1 hover:bg-brand/10">
              ×
            </button>
          </span>
        ) : (
          <button onClick={() => setView("booked")} className="text-sm font-bold text-brand hover:underline">
            Show booked appointments
          </button>
        )}
      </div>

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
        <select
          className="field sm:w-64"
          value={status}
          onChange={(e) => {
            const next = e.target.value as Status | "";
            setStatus(next);
            setParams(next ? { status: next } : {});
          }}
          aria-label="Filter by status"
        >
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
                      <button className="text-left font-bold hover:text-brand" onClick={() => setOpenId(c.id)}>
                        {c.full_name}
                      </button>
                      <div className="text-xs text-slate-500">{c.country ?? c.email}</div>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">{c.desired_course || labelFor(STUDY_PATHS, c.study_path)}</td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      {callTimeOf(c) ? (
                        <div className="space-y-1">
                          <div>{formatSlot(callTimeOf(c)!)}</div>
                          <CallBadge c={c} />
                          {isBookedLead(c) && <StartSessionLink c={c} />}
                        </div>
                      ) : (
                        <CallBadge c={c} />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label={statusLabel(c.status)} muted={c.status === "not_interested"} />
                      {c.session_outcome && <div className="mt-1 text-[11px] font-bold text-slate-500">Session: {SESSION_LABEL[c.session_outcome]}</div>}
                    </td>
                    <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && <Detail c={open as Row} all={items} onClose={() => setOpenId(null)} onSaved={load} />}
      {adding && (
        <AddLead
          onClose={() => { setAdding(false); setParams({}); }}
          onCreated={(id) => {
            setAdding(false);
            setParams({ lead: id });
            setOpenId(id);
            load();
          }}
        />
      )}
    </div>
  );
}

const SESSION_LABEL = { interviewed: "Interviewed", no_attendance: "No attendance", no_longer_interested: "No longer interested" } as const;

function AddLead({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("admin-create-lead", {
      body: { full_name: name.trim(), email: email.trim().toLowerCase(), status },
    });
    setSaving(false);
    if (invokeError || data?.error) return setError(data?.error ?? invokeError?.message ?? "Could not add the lead");
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/45 p-4" onClick={onClose}>
      <Card>
        <form onSubmit={submit} className="w-[min(32rem,calc(100vw-2rem))] space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Add new lead</h2>
              <p className="mt-1 text-sm text-slate-500">The candidate receives an email for the selected status with a secure dashboard button.</p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-mist"><X className="h-5 w-5" /></button>
          </div>
          <div>
            <label className="label" htmlFor="new-lead-name">Full name</label>
            <input id="new-lead-name" className="field" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="new-lead-email">Email</label>
            <input id="new-lead-email" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="new-lead-status">Status</label>
            <select id="new-lead-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={saving} className="w-full"><Plus className="h-4 w-4" /> Add lead and send email</Button>
        </form>
      </Card>
    </div>
  );
}

function StartSessionLink({ c }: { c: Row }) {
  return (
    <Link
      to={sessionHref(c)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brand/90"
    >
      <Play className="h-3 w-3 fill-current" /> Start session
    </Link>
  );
}

const isBookedLead = (c: Row) =>
  c.call_status === "confirmed" && !c.call_declined_at && !["interviewed", "no_longer_interested"].includes(c.session_outcome ?? "");

// Confirmed time, otherwise the suggested time, otherwise the candidate's first choice.
const callTimeOf = (c: Row) => (c.call_status === "confirmed" ? c.preferred_call_at : c.suggested_call_at ?? c.requested_call_times[0]) ?? null;

const STAGE_BADGE = {
  requested: ["Requested", "bg-amber-100 text-amber-800"],
  reviewed: ["Reviewed", "bg-amber-100 text-amber-800"],
  suggested: ["Awaiting confirm", "bg-sky-100 text-sky-800"],
  confirmed: ["Confirmed", "bg-emerald-100 text-emerald-800"],
  declined: ["Not a fit", "bg-slate-100 text-slate-500"],
} as const;

function CallBadge({ c }: { c: Row }) {
  const stage = callStage(c);
  if (stage === "none") return <span className="text-slate-400">—</span>;
  const [label, style] = noReply24h(c) ? (["No reply 24h+", "bg-brand-red/10 text-brand-red"] as const) : STAGE_BADGE[stage];
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${style}`}>{label}</span>;
}

function Detail({ c, all, onClose, onSaved }: { c: Row; all: Row[]; onClose: () => void; onSaved: () => void }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const loadDocs = useCallback(() => {
    supabase
      .from("documents")
      .select("*")
      .eq("consultation_id", c.id)
      .order("created_at")
      .then(({ data }) => setDocs(data ?? []));
  }, [c.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Approve, or ask for a new file with a short reason the candidate will see.
  const reviewDoc = async (d: DocumentRow, review_status: DocumentRow["review_status"]) => {
    let review_note: string | null = null;
    if (review_status === "rejected") {
      review_note = prompt(`Why does "${d.file_name}" need a new file? The candidate will see this.`, "Photo is blurry — please upload a clearer one.");
      if (review_note === null) return;
    }
    const { error } = await supabase
      .from("documents")
      .update({ review_status, review_note, reviewed_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    loadDocs();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const quickUpdate = async (fields: Partial<Row>) => {
    const { error } = await supabase.from("consultations").update(fields).eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    onSaved();
  };

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

  const requiredDocs = documentTypesFor(c.study_path).filter((t) => t.required);
  const hasDoc = (key: string) => docs.some((d) => d.doc_type === key && d.review_status !== "rejected");
  const referredBy = c.tracking.ref ? all.find((x) => x.referral_code === c.tracking.ref && x.id !== c.id) : undefined;
  const referrals = all.filter((x) => x.tracking.ref === c.referral_code && x.id !== c.id);
  const rows: [string, string | null | undefined][] = [
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
    ["Referred by", referredBy ? `${referredBy.full_name} (${referredBy.email})` : c.tracking.ref ? `Code ${c.tracking.ref}` : null],
    ["Referrals", referrals.length ? `${referrals.length}: ${referrals.map((x) => x.full_name).join(", ")}` : null],
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
            <h2 id="detail-title" className="flex items-center gap-2 text-xl font-black">
              {c.full_name}
              <button
                aria-label={c.is_starred ? "Unstar" : "Star (shown first in the presenter queue)"}
                aria-pressed={c.is_starred}
                onClick={() => quickUpdate({ is_starred: !c.is_starred })}
                className="rounded-full p-1 hover:bg-amber-50"
              >
                <Star className={`h-5 w-5 ${c.is_starred ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
              </button>
            </h2>
            <p className="text-sm text-slate-500">{c.user_id ? "Has an account" : "No linked account yet"}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-brand/5 hover:bg-brand/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <CallPanel c={c} onSaved={onSaved} />

          <div className="rounded-2xl bg-mist p-4">
            <label htmlFor="lead-status" className="label">Lead status</label>
            <select
              id="lead-status"
              className="field mt-1"
              value={c.status}
              onChange={(e) => quickUpdate({ status: e.target.value as Status })}
            >
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <a
              href={`/dashboard?preview=${encodeURIComponent(c.id)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
            >
              <ExternalLink className="h-4 w-4" /> Open candidate dashboard
            </a>
          </div>

          <SessionPanel c={c} />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="meet-link" className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
              <Video className="h-4 w-4 text-brand" /> Meet link
            </label>
            <input
              id="meet-link"
              type="url"
              placeholder="https://meet.google.com/…"
              className="field py-2"
              defaultValue={c.meeting_url ?? ""}
              onBlur={(e) => e.target.value.trim() !== (c.meeting_url ?? "") && quickUpdate({ meeting_url: e.target.value.trim() || null })}
            />
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
            <h3 className="mb-2 text-sm font-extrabold">
              Documents{" "}
              <span className="font-normal text-slate-500">
                ({requiredDocs.filter((t) => hasDoc(t.key)).length}/{requiredDocs.length} required:{" "}
                {requiredDocs.map((t) => `${hasDoc(t.key) ? "✓" : "✗"} ${t.label}`).join(", ")})
              </span>
            </h3>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="rounded-xl bg-mist px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button onClick={() => openDoc(d)} className="flex min-w-0 items-center gap-2 text-sm hover:underline">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{d.file_name}</span>
                        {d.doc_type && (
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                            {documentTypesFor(c.study_path).find((t) => t.key === d.doc_type)?.label ?? d.doc_type}
                          </span>
                        )}
                      </button>
                      <span className="flex items-center gap-1.5">
                        {d.review_status === "pending" ? (
                          <>
                            <button
                              onClick={() => reviewDoc(d, "approved")}
                              className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => reviewDoc(d, "rejected")}
                              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-red ring-1 ring-brand-red/30 hover:bg-brand-red/5"
                            >
                              Needs a new file
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                d.review_status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-brand-red/10 text-brand-red"
                              }`}
                            >
                              {d.review_status === "approved" ? "Approved" : "Needs a new file"}
                            </span>
                            <button onClick={() => reviewDoc(d, "pending")} className="text-xs font-bold text-slate-400 hover:text-navy">
                              Undo
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    {d.review_status === "rejected" && d.review_note && <p className="mt-1 text-xs text-brand-red">“{d.review_note}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-5">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
