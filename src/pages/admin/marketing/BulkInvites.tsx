import { useMemo, useRef, useState } from "react";
import { CalendarClock, Download, FileUp, ListChecks, Send, Trash2, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { Alert, Button } from "../../../components/ui";

export interface QueueContact {
  id: string;
  full_name: string;
  email: string;
  status: string;
  send_count: number;
  scheduled_at: string | null;
  batch_id: string | null;
}

interface Row {
  full_name: string;
  email: string;
  issue: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GAPS = [1, 2, 5, 10, 15];
const time = (d: Date | string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const duration = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim());

/** Splits one CSV line, honouring quotes. */
function cells(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') (cur += '"'), i++;
      else quoted = !quoted;
    } else if (ch === sep && !quoted) out.push(cur.trim()), (cur = "");
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * CSV or pasted list → name + email. Accepts a header row (name / full name / first name / last name / email)
 * or plain "Name, email" lines; the separator (comma, semicolon or tab) is detected.
 */
export function parseCandidates(text: string): { full_name: string; email: string }[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0];
  const sepOf = (line: string) => [",", ";", "\t"].sort((a, b) => line.split(b).length - line.split(a).length)[0];
  const sep = sepOf(first);
  const head = cells(first, sep).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const hasHeader = head.some((h) => h.includes("email") || h === "mail") && !cells(first, sep).some((c) => emailPattern.test(c));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iEmail = hasHeader ? head.findIndex((h) => h.includes("email") || h === "mail") : -1;
  const iName = col("name", "fullname", "candidate", "candidatename", "nom");
  const iFirst = col("firstname", "first", "givenname", "prenom");
  const iLast = col("lastname", "last", "surname", "familyname");
  return (hasHeader ? lines.slice(1) : lines).map((line) => {
    // Pasted lists may mix separators, so without a header each line picks its own.
    const c = cells(line, hasHeader ? sep : sepOf(line));
    const email = (iEmail >= 0 ? c[iEmail] : c.find((x) => x.includes("@"))) ?? "";
    let name: string;
    if (hasHeader && iName >= 0) name = c[iName] ?? "";
    else if (hasHeader && (iFirst >= 0 || iLast >= 0)) name = [c[iFirst], c[iLast]].filter(Boolean).join(" ");
    else name = c.filter((x) => x && x !== email).join(" ");
    return { full_name: name.replace(/\s+/g, " ").trim(), email: email.trim().toLowerCase() };
  });
}

const SAMPLE = "full_name,email\nSara Benali,sara@example.com\nYoussef Amrani,youssef@example.com\n";

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-bold ring-1 transition ${on ? "bg-brand text-white ring-brand" : "bg-white text-slate-600 ring-slate-200 hover:ring-brand"}`;

/** Many candidates at once: upload/paste a CSV, check the list, choose the time between emails, queue. */
export function BulkInvites({ contacts, onQueued }: { contacts: QueueContact[]; onQueued: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [gap, setGap] = useState(2);
  const [later, setLater] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [skipped, setSkipped] = useState<{ email: string; reason: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const known = useMemo(() => new Map(contacts.map((c) => [c.email, c])), [contacts]);
  const rows: Row[] = useMemo(() => {
    const seen = new Set<string>();
    return parseCandidates(text).map((r) => {
      const prev = known.get(r.email);
      const issue = !emailPattern.test(r.email)
        ? "Invalid email"
        : seen.has(r.email)
          ? "Duplicate"
          : prev?.status === "account_created"
            ? "Has an account"
            : prev?.status === "unsubscribed"
              ? "Unsubscribed"
              : prev && ["queued", "sending"].includes(prev.status)
                ? "Already queued"
                : prev && prev.send_count > 0
                  ? "Already invited"
                  : "";
      seen.add(r.email);
      return { ...r, issue };
    });
  }, [text, known]);
  const ready = rows.filter((r) => !r.issue);
  const start = later && startAt ? new Date(startAt) : new Date();
  const end = new Date(start.getTime() + Math.max(0, ready.length - 1) * gap * 60_000);

  const readFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setMsg(null);
    setSkipped([]);
  };

  const queue = async () => {
    if (!ready.length) return;
    if (later && (!startAt || new Date(startAt) < new Date())) return setMsg({ tone: "error", text: "Choose a start time in the future." });
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.functions.invoke("send-marketing-invite", {
      body: { action: "queue", contacts: ready.map(({ full_name, email }) => ({ full_name, email })), interval_minutes: gap, start_at: later ? new Date(startAt).toISOString() : undefined },
    });
    setBusy(false);
    if (error || data?.error) return setMsg({ tone: "error", text: data?.error || error?.message || "Could not queue the invitations." });
    setSkipped(data.skipped ?? []);
    setMsg({
      tone: "success",
      text: data.queued
        ? `${data.queued} invitation${data.queued > 1 ? "s" : ""} queued — one every ${duration(gap)}${data.sentNow ? ", the first one is already sent" : ""}. Last one ≈ ${time(data.last_at)}.`
        : "Nothing to queue — every candidate was skipped.",
    });
    setText("");
    setFileName("");
    onQueued();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "candidates-sample.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {skipped.length > 0 && (
        <details className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <summary className="cursor-pointer font-bold">{skipped.length} skipped</summary>
          <ul className="mt-2 space-y-0.5">
            {skipped.map((s) => (
              <li key={s.email + s.reason}>
                {s.email} — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            readFile(e.dataTransfer.files[0]);
          }}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center"
        >
          <FileUp className="h-8 w-8 text-brand" />
          <p className="text-sm font-bold text-navy">{fileName || "Drop a CSV file here"}</p>
          <p className="text-xs text-slate-500">Columns: full name (or first + last name) and email.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              Choose file
            </Button>
            <button type="button" onClick={download} className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
              <Download className="h-3.5 w-3.5" /> Sample CSV
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
        <label className="block">
          <span className="label">…or paste one candidate per line</span>
          <textarea
            className="field font-mono text-xs"
            rows={7}
            placeholder={"Sara Benali, sara@example.com\nYoussef Amrani; youssef@example.com"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName("");
            }}
          />
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{ready.length} ready</span>
            {rows.length - ready.length > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700">{rows.length - ready.length} will be skipped</span>}
            <button type="button" onClick={() => setText("")} className="ml-auto inline-flex items-center gap-1 font-bold text-slate-500 hover:text-brand-red">
              <X className="h-3.5 w-3.5" /> Clear list
            </button>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-3 py-1.5">{r.full_name || <span className="text-slate-400">—</span>}</td>
                    <td className="break-all px-3 py-1.5">{r.email || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-1.5 text-xs font-bold">{r.issue ? <span className="text-amber-700">{r.issue}</span> : <span className="text-emerald-700">Ready</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="grid gap-4 rounded-xl bg-slate-50 p-4 lg:grid-cols-2">
        <div>
          <span className="label">Time between emails</span>
          <div className="flex flex-wrap items-center gap-2">
            {GAPS.map((m) => (
              <button key={m} type="button" onClick={() => setGap(m)} className={chip(gap === m)}>
                {m} min
              </button>
            ))}
            <label className="inline-flex items-center gap-1 text-sm text-slate-600">
              <input type="number" min={1} max={1440} className="field w-20 py-1.5" value={gap} onChange={(e) => setGap(Math.min(1440, Math.max(1, Math.round(Number(e.target.value) || 1))))} aria-label="Custom minutes between emails" />
              min
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Spacing emails out protects the sender reputation and keeps invitations out of spam folders.</p>
        </div>
        <div>
          <span className="label">Start</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLater(false)} className={chip(!later)}>
              Now
            </button>
            <button type="button" onClick={() => setLater(true)} className={chip(later)}>
              Schedule
            </button>
          </div>
          {later && <input type="datetime-local" className="field mt-2" value={startAt} onChange={(e) => setStartAt(e.target.value)} />}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-sm text-slate-600">
          <CalendarClock className="h-4 w-4 shrink-0 text-brand" />
          {ready.length
            ? `${ready.length} email${ready.length > 1 ? "s" : ""} · first ${later && startAt ? time(start) : "now"} · last ≈ ${time(end)} (${duration(Math.max(0, ready.length - 1) * gap)})`
            : "Add candidates to see the sending plan."}
        </p>
        <Button type="button" loading={busy} disabled={!ready.length} onClick={queue}>
          <Send className="h-4 w-4" />
          Queue {ready.length || ""} invitation{ready.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}

/** Live sending queue with cancel controls. */
export function InviteQueue({ contacts, onChange }: { contacts: QueueContact[]; onChange: () => void }) {
  const [busy, setBusy] = useState("");
  const queued = contacts.filter((c) => c.status === "queued" || c.status === "sending").sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  if (!queued.length) return null;
  const cancel = async (ids?: string[]) => {
    if (!ids && !confirm(`Cancel all ${queued.length} queued invitations?`)) return;
    setBusy(ids?.[0] ?? "all");
    await supabase.functions.invoke("send-marketing-invite", { body: { action: "cancel", ids } });
    setBusy("");
    onChange();
  };
  const last = queued[queued.length - 1].scheduled_at;
  return (
    <div className="px-5 py-6 sm:px-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <ListChecks className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">Sending queue</h2>
            <p className="text-xs text-slate-500">
              {queued.length} left · next {queued[0].scheduled_at ? time(queued[0].scheduled_at) : "now"}
              {last ? ` · last ≈ ${time(last)}` : ""}
            </p>
          </div>
        </div>
        <Button type="button" variant="danger" loading={busy === "all"} onClick={() => cancel()}>
          <Trash2 className="h-4 w-4" /> Cancel all
        </Button>
      </div>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-auto rounded-lg ring-1 ring-slate-200">
        {queued.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-28 shrink-0 text-xs font-bold text-brand">{c.status === "sending" ? "Sending…" : c.scheduled_at ? time(c.scheduled_at) : "—"}</span>
            <span className="min-w-0 flex-1 truncate">
              <strong className="text-navy">{c.full_name}</strong> <span className="text-slate-500">{c.email}</span>
            </span>
            {c.status === "queued" && (
              <button type="button" onClick={() => cancel([c.id])} disabled={busy === c.id} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-red" aria-label={`Cancel ${c.email}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
