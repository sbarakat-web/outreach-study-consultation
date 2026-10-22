import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { CalendarCheck, CheckCircle2, Circle, FileText, KeyRound, Trash2, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ENGLISH_LEVELS, STATUSES, STUDY_PATHS, documentTypesFor, formatSlot, labelFor, statusLabel, type DocumentType } from "../lib/options";
import type { Consultation, DocumentRow } from "../lib/types";
import { Alert, Button, Card, Spinner, StatusBadge } from "../components/ui";
import { BookingCalendar } from "../components/BookingCalendar";

// Candidate-facing milestones (a subset of the CRM stages).
const MILESTONES = ["consultation_booked", "documents_requested", "application_submitted", "offer_received", "visa_process", "enrolled"];

interface CandidateContext {
  c: Consultation;
  docs: DocumentRow[];
  reload: () => void;
  userId: string;
}

const useCandidate = () => useOutletContext<CandidateContext>();

const requiredProgress = (c: Consultation, docs: DocumentRow[]) => {
  const required = documentTypesFor(c.study_path).filter((t) => t.required);
  const done = required.filter((t) => docs.some((d) => d.doc_type === t.key)).length;
  return { done, total: required.length };
};

/** Candidate area: one application, with a sidebar for the call and documents. */
export function CandidateLayout() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [c, setC] = useState<Consultation | null | undefined>(undefined);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [res, d] = await Promise.all([
      supabase
        .from("consultations")
        .select("*")
        .or(`user_id.eq.${userId},email.eq."${(session!.user.email ?? "").toLowerCase()}"`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("documents").select("*").eq("user_id", userId).order("created_at"),
    ]);
    if (res.error) setError(res.error.message);
    setC((res.data as Consultation) ?? null);
    setDocs(d.data ?? []);
  }, [userId, session]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (c === undefined) return <Spinner />;

  if (c === null) {
    return (
      <div className="mx-auto max-w-xl pt-6">
        {error && <Alert>{error}</Alert>}
        <Card>
          <div className="px-6 py-10 text-center">
            <p className="text-slate-600">You don’t have an application yet.</p>
            <Link to="/" className="mt-4 inline-block">
              <Button>Start your application</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const myDocs = docs.filter((d) => d.consultation_id === c.id);
  const progress = requiredProgress(c, myDocs);
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition ${
      isActive ? "bg-brand text-white" : "text-navy hover:bg-white"
    }`;

  return (
    <div className="grid gap-6 pt-4 md:grid-cols-[13rem_1fr]">
      <aside className="md:sticky md:top-4 md:self-start">
        <nav aria-label="My application" className="flex gap-1 overflow-x-auto rounded-2xl bg-white/60 p-1.5 ring-1 ring-slate-200 md:flex-col">
          <NavLink to="/dashboard" end className={navClass}>
            <span className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> My call
            </span>
          </NavLink>
          <NavLink to="/dashboard/documents" className={navClass}>
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Documents
            </span>
            <span
              className={`rounded-full px-1.5 text-[11px] ${
                progress.done === progress.total ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {progress.done}/{progress.total}
            </span>
          </NavLink>
        </nav>
      </aside>
      <div className="min-w-0 max-w-3xl space-y-6">
        {error && <Alert>{error}</Alert>}
        <Outlet context={{ c, docs: myDocs, reload, userId } satisfies CandidateContext} />
      </div>
    </div>
  );
}

export function CallPage() {
  const { c, docs, reload } = useCandidate();
  const justApplied = (useLocation().state as { justApplied?: boolean } | null)?.justApplied;
  const reached = MILESTONES.indexOf(c.status);
  const lost = c.status === "lost";
  const progress = requiredProgress(c, docs);

  return (
    <>
      {justApplied && (
        <Alert tone="success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Your application is created. Next step: pick a time for your free call below.
          </span>
        </Alert>
      )}

      <Card>
        <div className="space-y-5 px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">My application</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">{c.desired_course || labelFor(STUDY_PATHS, c.study_path)}</h1>
              <p className="text-sm text-slate-500">English level: {labelFor(ENGLISH_LEVELS, c.english_level)}</p>
            </div>
            <StatusBadge label={c.status === "new" ? "Application received" : statusLabel(c.status)} muted={lost} />
          </div>

          {!lost && <BookingCalendar c={c} onRequested={reload} />}

          {!lost && progress.done < progress.total && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand/5 px-4 py-3">
              <p className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-brand" />
                <span>
                  <strong>
                    {progress.done} of {progress.total}
                  </strong>{" "}
                  required documents uploaded — please upload them before your call.
                </span>
              </p>
              <Link to="/dashboard/documents">
                <Button variant="secondary">Upload documents</Button>
              </Link>
            </div>
          )}

          {!lost && (
            <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Progress">
              {MILESTONES.map((m, i) => (
                <li key={m} className="space-y-1">
                  <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-brand" : "bg-slate-200"}`} />
                  <span className={`block text-[10px] font-medium leading-tight ${i <= reached ? "text-navy" : "text-slate-400"}`}>
                    {STATUSES.find((s) => s.value === m)!.label}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <SetPassword />
    </>
  );
}

export function DocumentsPage() {
  const { c, docs, reload, userId } = useCandidate();
  const types = documentTypesFor(c.study_path);
  const progress = requiredProgress(c, docs);
  const known = new Set(types.map((t) => t.key));
  const other = docs.filter((d) => !d.doc_type || !known.has(d.doc_type));
  const callAt = c.call_status === "confirmed" ? c.preferred_call_at : c.requested_call_times[0];

  return (
    <Card>
      <div className="space-y-5 px-5 py-6 sm:px-7">
        <div>
          <h1 className="text-xl font-black sm:text-2xl">Documents</h1>
          <p className="mt-1 text-sm text-slate-600">
            Please upload these {callAt ? <>before your call on <strong>{formatSlot(callAt, { weekday: "long", month: "long" })}</strong></> : "before your call"}{" "}
            so your advisor can review your profile. PDF, JPG, PNG or Word, max 10 MB each.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-600">
              {progress.done}/{progress.total} required
            </span>
          </div>
        </div>

        <ul className="space-y-3">
          {types.map((t) => (
            <DocumentSlot key={t.key} type={t} files={docs.filter((d) => d.doc_type === t.key)} c={c} userId={userId} onChange={reload} />
          ))}
          <DocumentSlot
            type={{ key: "other", label: "Other documents", hint: "Anything else that helps your application", required: false }}
            files={other}
            c={c}
            userId={userId}
            onChange={reload}
          />
        </ul>
      </div>
    </Card>
  );
}

function DocumentSlot({
  type,
  files,
  c,
  userId,
  onChange,
}: {
  type: DocumentType;
  files: DocumentRow[];
  c: Consultation;
  userId: string;
  onChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const done = files.length > 0;

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB.`);
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${userId}/${c.id}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from("documents").upload(path, file);
        if (up.error) throw up.error;
        const ins = await supabase.from("documents").insert({
          consultation_id: c.id,
          user_id: userId,
          file_path: path,
          file_name: file.name,
          doc_type: type.key === "other" ? null : type.key,
        });
        if (ins.error) throw ins.error;
      }
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const open = async (d: DocumentRow) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (d: DocumentRow) => {
    if (!confirm(`Delete ${d.file_name}?`)) return;
    await supabase.storage.from("documents").remove([d.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return setError(error.message);
    onChange();
  };

  return (
    <li className={`rounded-2xl border-2 px-4 py-3 ${done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
          <div>
            <p className="font-bold">
              {type.label}{" "}
              {type.required ? (
                <span className="ml-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-bold text-brand-red">Required</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-slate-400">Optional</span>
              )}
            </p>
            <p className="text-xs text-slate-500">{type.hint}</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-brand ring-1 ring-slate-200 hover:bg-brand/5 focus-within:ring-2 focus-within:ring-brand">
          <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : done ? "Add file" : "Upload"}
          <input
            type="file"
            multiple
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            disabled={uploading}
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 pl-8">
          {files.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <button onClick={() => open(d)} className="flex min-w-0 items-center gap-2 text-navy hover:underline">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{d.file_name}</span>
              </button>
              <button aria-label={`Delete ${d.file_name}`} onClick={() => remove(d)} className="text-slate-400 hover:text-brand-red">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </li>
  );
}

// Optional: candidates sign in with an email link, but can add a password for faster sign-in.
function SetPassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setMsg({ tone: "error", text: "Your password needs at least 8 characters." });
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: "Password saved. You can now sign in with your email and password." });
    setPassword("");
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <KeyRound className="h-4 w-4 text-slate-400" /> You sign in with a link sent by email. A password is optional.
        </p>
        {!open && (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            Set a password
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            aria-label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </form>
      )}
      {msg && (
        <div className="mt-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </div>
  );
}
