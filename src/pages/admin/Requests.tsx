import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, FileText, MessageCircle, Search, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ENGLISH_LEVELS, STATUSES, STUDY_PATHS, formatSlot, labelFor, statusLabel, waLink } from "../../lib/options";
import { slotOf, type Consultation, type DocumentRow, type Status } from "../../lib/types";
import { Alert, Button, Card, Spinner, StatusBadge } from "../../components/ui";

export function Requests() {
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*, slots(id, starts_at, duration_minutes)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) setError(error.message);
    setItems((data as Consultation[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (c) =>
        (!status || c.status === status) &&
        (!q || [c.full_name, c.email, c.whatsapp, c.country, c.desired_course].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [items, query, status]);

  const upcoming = useMemo(
    () =>
      (items ?? [])
        .filter((c) => {
          const s = slotOf(c);
          return s && new Date(s.starts_at) > new Date();
        })
        .sort((a, b) => slotOf(a)!.starts_at.localeCompare(slotOf(b)!.starts_at))
        .slice(0, 5),
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
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-500">Next consultations</h2>
            <ul className="divide-y divide-slate-100">
              {upcoming.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:text-brand-blue">
                    <CalendarCheck className="h-4 w-4 shrink-0 text-brand-blue" />
                    <span className="w-44 shrink-0 font-bold">{formatSlot(slotOf(c)!.starts_at)}</span>
                    <span className="truncate">{c.full_name}</span>
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
                  <th className="hidden px-3 py-3 font-bold md:table-cell">Path</th>
                  <th className="hidden px-3 py-3 font-bold sm:table-cell">Consultation</th>
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
                    <td className="hidden px-3 py-3 md:table-cell">{labelFor(STUDY_PATHS, c.study_path)}</td>
                    <td className="hidden px-3 py-3 sm:table-cell">{slotOf(c) ? formatSlot(slotOf(c)!.starts_at) : "—"}</td>
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

      {open && <Detail c={open} onClose={() => setOpenId(null)} onSaved={load} />}
    </div>
  );
}

function Detail({ c, onClose, onSaved }: { c: Consultation; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<Status>(c.status);
  const [notes, setNotes] = useState(c.admin_notes ?? "");
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const slot = slotOf(c);

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

  const releaseSlot = async () => {
    if (!slot || !confirm("Free this time slot? The candidate will no longer have a booked time.")) return;
    const { error } = await supabase.from("slots").update({ consultation_id: null }).eq("id", slot.id);
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
              <a href={waLink(c.whatsapp, `Hi ${c.full_name.split(" ")[0]}, this is Outreach Recruitment about your study consultation.`)} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            )}
            <a href={`mailto:${c.email}`}>
              <Button variant="secondary">Email</Button>
            </a>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-brand-blue" />
              {slot ? <strong>{formatSlot(slot.starts_at, { weekday: "long", month: "long" })}</strong> : "No time booked"}
            </span>
            {slot && (
              <button onClick={releaseSlot} className="text-xs font-bold text-slate-500 hover:text-brand-red">
                Free slot
              </button>
            )}
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
