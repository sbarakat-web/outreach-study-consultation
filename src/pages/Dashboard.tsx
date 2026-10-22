import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, FileText, Plus, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ENGLISH_LEVELS, STATUSES, STUDY_PATHS, formatSlot, labelFor, statusLabel } from "../lib/options";
import { slotOf, type Consultation, type DocumentRow } from "../lib/types";
import { Alert, Button, Card, Spinner, StatusBadge } from "../components/ui";

// Candidate-facing milestones (a subset of the CRM stages).
const MILESTONES = ["consultation_booked", "documents_requested", "application_submitted", "offer_received", "visa_process", "enrolled"];

export function Dashboard() {
  const { session } = useAuth();
  const [items, setItems] = useState<Consultation[] | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([
      supabase
        .from("consultations")
        .select("*, slots(id, starts_at, duration_minutes)")
        .or(`user_id.eq.${session!.user.id},email.eq."${(session!.user.email ?? "").toLowerCase()}"`)
        .order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("user_id", session!.user.id).order("created_at"),
    ]);
    if (c.error) setError(c.error.message);
    setItems((c.data as Consultation[]) ?? []);
    setDocs(d.data ?? []);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  if (!items) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">My requests</h1>
        <Link to="/">
          <Button variant="secondary">
            <Plus className="h-4 w-4" /> New consultation
          </Button>
        </Link>
      </div>
      {error && <Alert>{error}</Alert>}
      {items.length === 0 && (
        <Card>
          <div className="px-6 py-10 text-center">
            <p className="text-slate-600">You don't have any consultation requests yet.</p>
            <Link to="/" className="mt-4 inline-block">
              <Button>Book a free consultation</Button>
            </Link>
          </div>
        </Card>
      )}
      {items.map((c) => (
        <RequestCard key={c.id} c={c} docs={docs.filter((d) => d.consultation_id === c.id)} onChange={load} userId={session!.user.id} />
      ))}
    </div>
  );
}

function RequestCard({ c, docs, onChange, userId }: { c: Consultation; docs: DocumentRow[]; onChange: () => void; userId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const slot = slotOf(c);
  const reached = MILESTONES.indexOf(c.status);
  const lost = c.status === "lost";

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB.`);
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${userId}/${c.id}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from("documents").upload(path, file);
        if (up.error) throw up.error;
        const ins = await supabase.from("documents").insert({ consultation_id: c.id, user_id: userId, file_path: path, file_name: file.name });
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

  return (
    <Card>
      <div className="space-y-5 px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Requested {new Date(c.created_at).toLocaleDateString()}
            </p>
            <h2 className="mt-1 text-lg font-black">
              {labelFor(STUDY_PATHS, c.study_path)} · {labelFor(ENGLISH_LEVELS, c.english_level)}
            </h2>
          </div>
          <StatusBadge label={statusLabel(c.status)} muted={lost} />
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-mist px-4 py-3">
          <CalendarCheck className="h-5 w-5 shrink-0 text-brand-blue" />
          <p className="text-sm">
            {slot ? (
              <>
                Consultation on <strong>{formatSlot(slot.starts_at, { weekday: "long", month: "long" })}</strong>
              </>
            ) : (
              "An advisor will contact you to arrange a time."
            )}
          </p>
        </div>

        {!lost && (
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Progress">
            {MILESTONES.map((m, i) => (
              <li key={m} className="space-y-1">
                <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-brand-blue" : "bg-slate-200"}`} />
                <span className={`block text-[10px] font-medium leading-tight ${i <= reached ? "text-navy" : "text-slate-400"}`}>
                  {STATUSES.find((s) => s.value === m)!.label}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">Documents</h3>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-brand-blue hover:bg-brand-blue/5">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
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
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">Passport, certificates, CV… upload them here when your advisor asks (PDF, JPG, PNG or Word, max 10 MB).</p>
          ) : (
            <ul className="space-y-1">
              {docs.map((d) => (
                <li key={d.id}>
                  <button onClick={() => open(d)} className="flex items-center gap-2 text-sm text-navy hover:underline">
                    <FileText className="h-4 w-4 text-slate-400" /> {d.file_name}
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
        </div>
      </div>
    </Card>
  );
}
