import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-white shadow-lg hover:bg-navy/90",
  secondary: "bg-white text-navy ring-1 ring-slate-200 hover:bg-slate-50",
  ghost: "text-navy hover:bg-navy/5",
  danger: "bg-white text-brand-red ring-1 ring-brand-red/30 hover:bg-brand-red/5",
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-extrabold transition outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`relative w-full overflow-hidden rounded-[2rem] border border-white/50 bg-white shadow-[0_28px_90px_rgba(3,12,40,0.12)] ${className}`}
    >
      <div aria-hidden className="h-2 w-full bg-gradient-to-r from-brand-red via-brand-red to-brand-violet" />
      {children}
    </section>
  );
}

export function ChoiceCard({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-2xl border-2 p-4 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
        selected ? "border-brand-blue bg-brand-blue/5" : "border-slate-100 bg-mist hover:border-slate-200"
      }`}
    >
      <span className="block font-extrabold text-navy">{label}</span>
      {hint && <span className="mt-0.5 block text-sm text-slate-500">{hint}</span>}
    </button>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-brand-red/5 text-brand-red ring-brand-red/20",
    info: "bg-brand-blue/5 text-navy ring-brand-blue/20",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ring-1 ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="grid place-items-center py-16 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function StatusBadge({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
        muted ? "bg-slate-100 text-slate-500" : "bg-brand-blue/10 text-brand-blue"
      }`}
    >
      {label}
    </span>
  );
}
