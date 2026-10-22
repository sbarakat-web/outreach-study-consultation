import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import {
  AlertCircle,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  FileText,
  Gift,
  KeyRound,
  MessageCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ENGLISH_LEVELS, STATUSES, STUDY_PATHS, documentTypesFor, formatSlot, labelFor, statusLabel, waLink, type DocumentType } from "../lib/options";
import { useI18n } from "../lib/i18n";
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

// A required document counts once it has a file that wasn't rejected.
const requiredProgress = (c: Consultation, docs: DocumentRow[]) => {
  const required = documentTypesFor(c.study_path).filter((t) => t.required);
  const done = required.filter((t) => docs.some((d) => d.doc_type === t.key && d.review_status !== "rejected")).length;
  return { done, total: required.length };
};

/** Candidate area: one application, with a sidebar for the call, documents and invites. */
export function CandidateLayout() {
  const { session } = useAuth();
  const { t } = useI18n();
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
            <p className="text-slate-600">{t("dash.noApp")}</p>
            <Link to="/" className="mt-4 inline-block">
              <Button>{t("dash.start")}</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const myDocs = docs.filter((d) => d.consultation_id === c.id);
  const progress = requiredProgress(c, myDocs);
  const rejected = myDocs.filter((d) => d.review_status === "rejected").length;
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition ${
      isActive ? "bg-brand text-white" : "text-navy hover:bg-white"
    }`;

  return (
    <div className="grid gap-6 pt-4 md:grid-cols-[13rem_1fr]">
      <aside className="md:sticky md:top-24 md:self-start">
        <nav aria-label={t("side.label")} className="flex gap-1 overflow-x-auto rounded-2xl bg-white/60 p-1.5 ring-1 ring-slate-200 md:flex-col">
          <NavLink to="/dashboard" end className={navClass}>
            <span className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> {t("side.call")}
            </span>
          </NavLink>
          <NavLink to="/dashboard/documents" className={navClass}>
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("side.documents")}
            </span>
            <span
              className={`rounded-full px-1.5 text-[11px] ${
                rejected
                  ? "bg-brand-red/15 text-brand-red"
                  : progress.done === progress.total
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {rejected ? `!${rejected}` : `${progress.done}/${progress.total}`}
            </span>
          </NavLink>
          <NavLink to="/dashboard/invite" className={navClass}>
            <span className="flex items-center gap-2">
              <Gift className="h-4 w-4" /> {t("side.invite")}
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
  const { t, tv } = useI18n();
  const justApplied = (useLocation().state as { justApplied?: boolean } | null)?.justApplied;
  const reached = MILESTONES.indexOf(c.status);
  const lost = c.status === "lost";
  const progress = requiredProgress(c, docs);
  const rejected = docs.filter((d) => d.review_status === "rejected").length;

  return (
    <>
      {justApplied && (
        <Alert tone="success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {t("dash.justApplied")}
          </span>
        </Alert>
      )}

      <Card>
        <div className="space-y-5 px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("dash.myApplication")}</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">{tv(c.desired_course || labelFor(STUDY_PATHS, c.study_path))}</h1>
              <p className="text-sm text-slate-500">{t("dash.englishLevel", { level: tv(labelFor(ENGLISH_LEVELS, c.english_level)) })}</p>
            </div>
            <StatusBadge label={c.status === "new" ? t("status.received") : tv(statusLabel(c.status))} muted={lost} />
          </div>

          {!lost && c.session_outcome === "interviewed" ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200 sm:px-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-black">{t("sess.doneTitle")}</p>
                  <p className="text-sm text-slate-600">{t("sess.doneText")}</p>
                </div>
              </div>
              <Link to="/dashboard/documents">
                <Button>{t("dash.uploadDocs")}</Button>
              </Link>
            </div>
          ) : (
            !lost && (
              <>
                {c.session_outcome === "no_attendance" && c.call_status !== "confirmed" && <Alert tone="info">{t("sess.missed")}</Alert>}
                <BookingCalendar c={c} onRequested={reload} />
              </>
            )
          )}

          {!lost && (progress.done < progress.total || rejected > 0) && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${rejected ? "bg-brand-red/5" : "bg-brand/5"}`}
            >
              <p className="flex items-center gap-2 text-sm">
                {rejected ? <AlertCircle className="h-4 w-4 text-brand-red" /> : <FileText className="h-4 w-4 text-brand" />}
                <span>
                  {rejected ? t("dash.docsRejected", { n: rejected }) : t("dash.docsNudge", { done: progress.done, total: progress.total })}
                </span>
              </p>
              <Link to="/dashboard/documents">
                <Button variant="secondary">{t("dash.uploadDocs")}</Button>
              </Link>
            </div>
          )}

          {!lost && (
            <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t("dash.progress")}>
              {MILESTONES.map((m, i) => (
                <li key={m} className="space-y-1">
                  <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-brand" : "bg-slate-200"}`} />
                  <span className={`block text-[10px] font-medium leading-tight ${i <= reached ? "text-navy" : "text-slate-400"}`}>
                    {tv(STATUSES.find((s) => s.value === m)!.label)}
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
  const { t } = useI18n();
  const types = documentTypesFor(c.study_path);
  const progress = requiredProgress(c, docs);
  const known = new Set(types.map((x) => x.key));
  const other = docs.filter((d) => !d.doc_type || !known.has(d.doc_type));
  const callAt = c.call_status === "confirmed" ? c.preferred_call_at : c.requested_call_times[0];

  return (
    <Card>
      <div className="space-y-5 px-5 py-6 sm:px-7">
        <div>
          <h1 className="text-xl font-black sm:text-2xl">{t("docs.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("docs.introA")}{" "}
            {callAt ? (
              <strong>{t("docs.beforeCallOn", { date: formatSlot(callAt, { weekday: "long", month: "long" }) })}</strong>
            ) : (
              t("docs.beforeCall")
            )}{" "}
            {t("docs.introB")}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-600">{t("docs.requiredCount", { done: progress.done, total: progress.total })}</span>
          </div>
        </div>

        <ul className="space-y-3">
          {types.map((type) => (
            <DocumentSlot key={type.key} type={type} files={docs.filter((d) => d.doc_type === type.key)} c={c} userId={userId} onChange={reload} />
          ))}
          <DocumentSlot type={{ key: "other", label: "", hint: "", required: false }} files={other} c={c} userId={userId} onChange={reload} />
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
  const { t, tv } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const done = files.some((d) => d.review_status !== "rejected");
  const needsNew = files.length > 0 && !done;
  const label = type.key === "other" ? t("docs.other") : tv(type.label);
  const hint = type.key === "other" ? t("docs.otherHint") : tv(type.hint);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(t("docs.tooBig", { name: file.name }));
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
      setError(err instanceof Error ? err.message : t("docs.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const open = async (d: DocumentRow) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (d: DocumentRow) => {
    if (!confirm(t("docs.confirmDelete", { name: d.file_name }))) return;
    await supabase.storage.from("documents").remove([d.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return setError(error.message);
    onChange();
  };

  const fileInput = (camera: boolean) => (
    <input
      type="file"
      multiple={!camera}
      className="sr-only"
      accept={camera ? "image/*" : ".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"}
      capture={camera ? "environment" : undefined}
      disabled={uploading}
      onChange={(e) => {
        upload(e.target.files);
        e.target.value = "";
      }}
    />
  );

  return (
    <li
      className={`rounded-2xl border-2 px-4 py-3 ${
        needsNew ? "border-brand-red/30 bg-brand-red/5" : done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {needsNew ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-red" />
          ) : done ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
          )}
          <div>
            <p className="font-bold">
              {label}{" "}
              {type.required ? (
                <span className="ms-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-bold text-brand-red">{t("docs.required")}</span>
              ) : (
                <span className="ms-1 text-xs font-normal text-slate-400">{t("docs.optional")}</span>
              )}
            </p>
            <p className="text-xs text-slate-500">{hint}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Phones open the camera directly; hidden on larger screens. */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-bold text-white focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 md:hidden">
            <Camera className="h-4 w-4" /> {t("docs.takePhoto")}
            {fileInput(true)}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-brand ring-1 ring-slate-200 hover:bg-brand/5 focus-within:ring-2 focus-within:ring-brand">
            <Upload className="h-4 w-4" /> {uploading ? t("docs.uploading") : done ? t("docs.addFile") : t("docs.upload")}
            {fileInput(false)}
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5 ps-8">
          {files.map((d) => (
            <li key={d.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => open(d)} className="flex min-w-0 items-center gap-2 text-navy hover:underline">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{d.file_name}</span>
                </button>
                <span className="flex shrink-0 items-center gap-2">
                  <ReviewBadge status={d.review_status} />
                  <button aria-label={t("docs.delete", { name: d.file_name })} onClick={() => remove(d)} className="text-slate-400 hover:text-brand-red">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </div>
              {d.review_status === "rejected" && d.review_note && <p className="mt-0.5 text-xs font-semibold text-brand-red">“{d.review_note}”</p>}
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

function ReviewBadge({ status }: { status: DocumentRow["review_status"] }) {
  const { t } = useI18n();
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> {t("docs.approved")}
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-bold text-brand-red">
        <AlertCircle className="h-3 w-3" /> {t("docs.rejected")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
      <Clock className="h-3 w-3" /> {t("docs.pending")}
    </span>
  );
}

export function InvitePage() {
  const { c } = useCandidate();
  const { t, tv } = useI18n();
  const [friends, setFriends] = useState<{ first_name: string; created_at: string; status: string }[] | null>(null);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?ref=${c.referral_code}`;

  useEffect(() => {
    supabase.rpc("my_referrals", { p_consultation_id: c.id }).then(({ data }) => setFriends(data ?? []));
  }, [c.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the link is still selectable
    }
  };

  return (
    <Card>
      <div className="space-y-6 px-5 py-6 sm:px-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Gift className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-black sm:text-2xl">{t("ref.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("ref.sub")}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ref-link">
            {t("ref.yourLink")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="ref-link" readOnly dir="ltr" className="field font-semibold" value={link} onFocus={(e) => e.target.select()} />
            <Button variant="secondary" onClick={copy}>
              <Copy className="h-4 w-4" /> {copied ? t("ref.copied") : t("ref.copy")}
            </Button>
          </div>
          <a
            href={waLink("", t("ref.shareText", { link }))}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-95"
          >
            <MessageCircle className="h-4 w-4" /> {t("ref.share")}
          </a>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-extrabold">{t("ref.friends")}</h2>
          {!friends ? (
            <Spinner />
          ) : friends.length === 0 ? (
            <p className="text-sm text-slate-500">{t("ref.none")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl bg-mist px-4">
              {friends.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-bold">{f.first_name}</span>
                  <span className="text-xs text-slate-500">
                    {t("ref.applied", { date: formatSlot(f.created_at, { hour: undefined, minute: undefined, weekday: undefined }) })} ·{" "}
                    {f.status === "new" ? t("status.received") : tv(statusLabel(f.status as Consultation["status"]))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

// Optional: candidates sign in with an email code, but can add a password for faster sign-in.
function SetPassword() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setMsg({ tone: "error", text: t("pw.short") });
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: t("pw.saved") });
    setPassword("");
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <KeyRound className="h-4 w-4 text-slate-400" /> {t("pw.info")}
        </p>
        {!open && (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            {t("pw.set")}
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            aria-label={t("pw.label")}
            autoComplete="new-password"
            placeholder={t("pw.placeholder")}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={saving}>
            {t("pw.save")}
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
