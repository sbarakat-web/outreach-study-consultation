import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Monitor, Moon, Smartphone, Sun, XCircle } from "lucide-react";
import { APP_URL, SAMPLE_VARS, renderEmail, spamCheck, type Block, type MarketingSettings } from "./shared";

// Rough email-client dark mode: invert colours, keep photos as they are.
const DARK_CSS = "<style>html{filter:invert(1) hue-rotate(180deg);background:#fff}img{filter:invert(1) hue-rotate(180deg)}</style>";

/** Rendered email in an iframe with desktop/mobile width and light/dark switches. */
export function Preview({ blocks, preheader, subject, settings }: { blocks: Block[]; preheader: string; subject: string; settings: MarketingSettings }) {
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const html = useMemo(() => {
    const out = renderEmail({ blocks, preheader, settings, vars: SAMPLE_VARS, appUrl: APP_URL, links: { unsubscribe: "#", preferences: "#" } }).html;
    return dark ? out.replace("</head>", `${DARK_CSS}</head>`) : out;
  }, [blocks, preheader, settings, dark]);
  const shownSubject = subject.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_w, k: string, fb?: string) => (SAMPLE_VARS as Record<string, string>)[k] ?? fb ?? "");

  const toggle = (on: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button type="button" onClick={onClick} aria-pressed={on} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold ${on ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Live preview</span>
        <div className="flex gap-1.5">
          {toggle(!mobile, () => setMobile(false), <Monitor className="h-3.5 w-3.5" />, "Desktop")}
          {toggle(mobile, () => setMobile(true), <Smartphone className="h-3.5 w-3.5" />, "Mobile")}
          {toggle(dark, () => setDark((d) => !d), dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />, dark ? "Dark" : "Light")}
        </div>
      </div>
      <div className="rounded-xl bg-white px-4 py-2.5 text-sm ring-1 ring-slate-200">
        <span className="text-slate-400">Subject: </span>
        <strong>{shownSubject || "—"}</strong>
        {preheader && <span className="block truncate text-xs text-slate-400">{preheader}</span>}
      </div>
      <div className="flex justify-center rounded-xl bg-slate-200/60 p-3">
        <iframe title="Email preview" srcDoc={html} className="h-[640px] rounded-lg bg-white shadow-lg transition-all" style={{ width: mobile ? 375 : "100%", maxWidth: 680 }} />
      </div>
      <p className="text-[11px] text-slate-400">Preview uses sample values (Sara, Bachelor in Business…).</p>
    </div>
  );
}

export function SpamPanel({ subject, blocks, settings }: { subject: string; blocks: Block[]; settings: MarketingSettings }) {
  const { score, issues } = spamCheck(subject, blocks, settings);
  const tone = score <= 2 ? "text-emerald-700 bg-emerald-50" : score <= 5 ? "text-amber-700 bg-amber-50" : "text-brand-red bg-red-50";
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-black">Spam check</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{score <= 2 ? "Good" : score <= 5 ? "Check" : "Risky"} · {score}/10</span>
      </div>
      <ul className="space-y-1 text-xs">
        {issues.map((i) => (
          <li key={i.message} className="flex items-start gap-1.5">
            {i.level === "ok" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : i.level === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-red" />}
            <span className="text-slate-600">{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
