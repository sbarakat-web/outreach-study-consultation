import { useEffect, useMemo, useState } from "react";
import { Check, Mail, MessageCircle, RotateCcw, Save, X } from "lucide-react";
import type { Consultation } from "../../lib/types";
import { Alert, Button, Spinner } from "../../components/ui";
import { maltaTime } from "./calls";
import {
  REMINDER_DEFAULTS,
  fillReminder,
  loadReminderText,
  previewReminderHtml,
  resetReminderText,
  saveReminderText,
  type ReminderKind,
  type ReminderText,
} from "../../lib/reminderTemplate";

const FIELDS: { key: keyof ReminderText; label: string; rows?: number }[] = [
  { key: "subject", label: "Subject" },
  { key: "heading", label: "Heading" },
  { key: "intro", label: "Message", rows: 4 },
  { key: "button", label: "Button text" },
  { key: "points", label: "What we'll do in the call (one per line)", rows: 3 },
  { key: "note", label: "Small note under it", rows: 2 },
  { key: "whatsapp", label: "WhatsApp message", rows: 8 },
];

/**
 * Preview and edit the booking reminder (new leads) or the rebook reminder (cancelled appointments).
 * Saving makes it the template for every reminder from now on, including Email all.
 */
export function ReminderEditor({ kind, sample, onClose }: { kind: ReminderKind; sample?: Consultation; onClose: () => void }) {
  const [text, setText] = useState<ReminderText | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"email" | "whatsapp">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    loadReminderText(kind).then((r) => {
      setText(r.text);
      setSaved(r.saved);
    });
  }, [kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Preview with a real candidate from the list when there is one.
  const vars = useMemo(() => {
    const cancelledAt = sample?.tracking?.appointment_cancelled_call_at;
    return {
      name: sample?.full_name.split(" ")[0] ?? "Maria",
      course: sample?.desired_course || "your studies in Malta",
      date: cancelledAt ? maltaTime(cancelledAt) : "Monday 23 November, 13:00",
      link: `${window.location.origin}/confirm-call?t=…&pick=1`,
    };
  }, [sample]);

  const save = async () => {
    if (!text) return;
    setBusy(true);
    const { error } = await saveReminderText(kind, text);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setSaved(true);
    setMsg({ tone: "success", text: "Saved. Every reminder from now on uses this text, including Email all." });
  };

  const reset = async () => {
    if (!confirm("Go back to the original text? Your saved version will be removed.")) return;
    setBusy(true);
    const { error } = await resetReminderText(kind);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setText(REMINDER_DEFAULTS[kind]);
    setSaved(false);
    setMsg({ tone: "success", text: "Back to the original text." });
  };

  const changed = text && JSON.stringify(text) !== JSON.stringify(REMINDER_DEFAULTS[kind]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-navy/40 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-editor-title"
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="reminder-editor-title" className="text-xl font-black">
              {kind === "rebook" ? "Rebook reminder (cancelled appointments)" : "Booking reminder (new leads)"}
            </h2>
            <p className="text-xs text-slate-500">
              {saved ? (
                <span className="font-bold text-emerald-700">
                  <Check className="inline h-3.5 w-3.5" /> Using your saved template
                </span>
              ) : (
                "Using the original text"
              )}{" "}
              · Preview for {sample ? sample.full_name : "an example candidate"}
            </p>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/5 hover:bg-brand/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!text ? (
          <Spinner />
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
            <div className="space-y-3 px-5 py-4 sm:px-6 lg:overflow-y-auto">
              <p className="rounded-xl bg-mist px-3 py-2 text-xs text-slate-600">
                Personal details fill in automatically: <code className="font-bold">{"{name}"}</code>, <code className="font-bold">{"{course}"}</code>,{" "}
                {kind === "rebook" && (
                  <>
                    <code className="font-bold">{"{date}"}</code> (the cancelled appointment),{" "}
                  </>
                )}
                <code className="font-bold">{"{link}"}</code> (WhatsApp only — the email has the button). Write <code className="font-bold">**text**</code> for bold.
              </p>
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label">{f.label}</span>
                  {f.rows ? (
                    <textarea className="field text-sm" rows={f.rows} value={text[f.key]} onChange={(e) => setText({ ...text, [f.key]: e.target.value })} />
                  ) : (
                    <input className="field text-sm" value={text[f.key]} onChange={(e) => setText({ ...text, [f.key]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>

            <div className="flex min-h-[32rem] flex-col border-t border-slate-100 bg-mist lg:border-l lg:border-t-0">
              <div className="flex items-center gap-1 px-4 pt-3" role="tablist" aria-label="Preview">
                {(
                  [
                    ["email", "Email", Mail],
                    ["whatsapp", "WhatsApp", MessageCircle],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${tab === key ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-navy"}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              {tab === "email" ? (
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <p className="mb-2 truncate rounded-xl bg-white px-3 py-2 text-sm">
                    <span className="text-slate-400">Subject: </span>
                    <strong>{fillReminder(text.subject, vars)}</strong>
                  </p>
                  <iframe title="Email preview" srcDoc={previewReminderHtml(kind, text, vars)} className="min-h-[28rem] w-full flex-1 rounded-2xl border-0 bg-white" />
                </div>
              ) : (
                <div className="flex-1 bg-[#e5ddd5] p-4">
                  <div className="ml-auto max-w-sm whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-sm text-navy shadow-sm">
                    {fillReminder(text.whatsapp, vars)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3 sm:px-6">
          <Button onClick={save} loading={busy} disabled={busy || !text}>
            <Save className="h-4 w-4" /> Save as template
          </Button>
          {(saved || changed) && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Back to original
            </Button>
          )}
          <span className="text-xs text-slate-500">Saved text is used for every reminder from now on.</span>
          {msg && (
            <div className="w-full">
              <Alert tone={msg.tone}>{msg.text}</Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
