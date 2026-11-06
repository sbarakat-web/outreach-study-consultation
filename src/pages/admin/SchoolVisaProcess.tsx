import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Save, School, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Alert, Button, Card, Spinner } from "../../components/ui";
import { PageTitle } from "../../components/dash";

const SOURCE = "school_visa_process";
const STATUSES = [
  { value: "reviewing", label: "Reviewing", style: "bg-blue-500 text-white" },
  { value: "fee_paid", label: "Fee Paid", style: "bg-amber-500 text-white" },
  { value: "approved", label: "Approved", style: "bg-emerald-500 text-white" },
  { value: "not_approved", label: "Not Approved", style: "bg-red-500 text-white" },
] as const;

type ProcessStatus = (typeof STATUSES)[number]["value"];
interface ProcessRow {
  id: string;
  full_name: string;
  email: string;
  admin_notes: string | null;
  tracking: Record<string, string>;
  created_at: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const statusOf = (row: ProcessRow) => (row.tracking.school_status || "reviewing") as ProcessStatus;
const statusMeta = (status: ProcessStatus) => STATUSES.find((s) => s.value === status) ?? STATUSES[0];

/** Manual-only school and visa pipeline. These records never enter lead communications. */
export function SchoolVisaProcess() {
  const [rows, setRows] = useState<ProcessRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("consultations").select("id, full_name, email, admin_notes, tracking, created_at").order("created_at", { ascending: false }).limit(5000);
    if (error) setError(error.message);
    setRows(((data as ProcessRow[]) ?? []).filter((row) => row.tracking?.source === SOURCE));
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("school-visa-process").on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const update = async (row: ProcessRow, fields: { status?: ProcessStatus; comment?: string }) => {
    setError("");
    const changes: Record<string, unknown> = {};
    if (fields.status) changes.tracking = { ...row.tracking, school_status: fields.status };
    if (fields.comment !== undefined) changes.admin_notes = fields.comment.trim() || null;
    const { error } = await supabase.from("consultations").update(changes).eq("id", row.id);
    if (error) setError(error.message);
    else load();
  };

  const remove = async (row: ProcessRow) => {
    if (!window.confirm(`Remove ${row.full_name} from School / Visa Process?`)) return;
    const { error } = await supabase.from("consultations").delete().eq("id", row.id);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add application
          </Button>
        }
      >
        School / Visa Process
      </PageTitle>

      <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        <School className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Manual records only.</strong> Candidates here already started their school process. The app will not send them emails, WhatsApp messages, reminders, or booking invitations.</p>
      </div>

      {error && <Alert>{error}</Alert>}
      {adding && <AddApplication onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); }} />}

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <div className="px-6 py-12 text-center">
            <School className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-black">No school applications yet</p>
            <p className="mt-1 text-sm text-slate-500">Add the first candidate manually. Nothing will be sent to them.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Applied Date</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Comment</th>
                  <th className="w-12 px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <ProcessTableRow key={row.id} row={row} onUpdate={update} onRemove={remove} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProcessTableRow({ row, onUpdate, onRemove }: { row: ProcessRow; onUpdate: (row: ProcessRow, fields: { status?: ProcessStatus; comment?: string }) => Promise<void>; onRemove: (row: ProcessRow) => void }) {
  const [comment, setComment] = useState(row.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const status = statusOf(row);
  const meta = statusMeta(status);
  const saveComment = async () => {
    if (comment.trim() === (row.admin_notes ?? "").trim()) return;
    setSaving(true);
    await onUpdate(row, { comment });
    setSaving(false);
  };
  return (
    <tr className="align-top hover:bg-slate-50/60">
      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">{row.tracking.school_applied_date || row.created_at.slice(0, 10)}</td>
      <td className="px-5 py-4 font-black text-navy">{row.full_name}</td>
      <td className="px-5 py-4"><a className="text-brand hover:underline" href={`mailto:${row.email}`}>{row.email}</a></td>
      <td className="px-5 py-4">
        <select
          aria-label={`Status for ${row.full_name}`}
          value={status}
          onChange={(e) => onUpdate(row, { status: e.target.value as ProcessStatus })}
          className={`cursor-pointer rounded-full border-0 px-4 py-2 text-sm font-black outline-none ring-2 ring-transparent focus:ring-navy/20 ${meta.style}`}
        >
          {STATUSES.map((option) => <option key={option.value} value={option.value} className="bg-white text-navy">{option.label}</option>)}
        </select>
      </td>
      <td className="min-w-64 px-5 py-3">
        <div className="flex items-start gap-2">
          <textarea rows={2} className="field min-h-16 resize-y py-2 text-sm" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} onBlur={saveComment} />
          {saving && <Save className="mt-2 h-4 w-4 animate-pulse text-brand" />}
        </div>
      </td>
      <td className="px-3 py-4">
        <button type="button" aria-label={`Remove ${row.full_name}`} onClick={() => onRemove(row)} className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-brand-red">
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function AddApplication({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<ProcessStatus>("reviewing");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { data, error } = await supabase.functions.invoke("admin-school-process", {
      body: { full_name: name.trim(), email: email.trim().toLowerCase(), applied_date: date, status, comment: comment.trim() },
    });
    setSaving(false);
    if (error || data?.error) return setError(data?.error ?? error?.message ?? "The application could not be saved");
    onAdded();
  };
  return (
    <Card>
      <form onSubmit={submit} className="space-y-4 px-5 py-6 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-black">Add school application</h2><p className="text-xs text-slate-500">Saved internally only. No message will be sent.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Applied Date *</span><input required type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Status *</span><select className="field" value={status} onChange={(e) => setStatus(e.target.value as ProcessStatus)}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Name *</span><input required className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Candidate name" /></label>
          <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Email *</span><input required type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidate@email.com" /></label>
        </div>
        <label className="block space-y-1"><span className="text-xs font-bold text-slate-500">Comment</span><textarea rows={3} className="field resize-y" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="School, programme, visa notes…" /></label>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>Add application</Button></div>
      </form>
    </Card>
  );
}
