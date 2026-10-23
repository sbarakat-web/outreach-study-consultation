import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Country } from "../lib/countries";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Country select with a search box (name, ISO code or dial code). `variant="dial"` shows the
 * flag + dial code (for the WhatsApp number), `"name"` the flag + country name.
 */
export function CountryPicker({
  id,
  value,
  onChange,
  countries,
  variant = "name",
  searchPlaceholder,
  ariaLabel,
  className = "",
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  countries: Country[];
  variant?: "name" | "dial";
  searchPlaceholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = countries.find((c) => c.code === value);

  const results = useMemo(() => {
    const s = fold(q.trim().replace(/^\+/, ""));
    if (!s) return countries;
    return countries.filter((c) => fold(c.name).includes(s) || c.code.toLowerCase() === s || c.dial.startsWith(s));
  }, [q, countries]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, results.findIndex((c) => c.code === value)));
  }, [open, results, value]);

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQ("");
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) pick(results[active].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="field flex items-center justify-between gap-2 text-start"
      >
        <span className="truncate">
          {current ? (variant === "dial" ? `${current.flag} +${current.dial}` : `${current.flag} ${current.name}`) : "—"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className={`absolute z-30 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200 ${variant === "dial" ? "w-72" : "w-full min-w-64"}`}>
          <label className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full py-3 text-sm text-navy outline-none placeholder:text-slate-400"
            />
          </label>
          <ul ref={list} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">—</li>}
            {results.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c.code)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? "bg-brand/5" : ""} ${c.code === value ? "font-bold text-brand" : "text-navy"}`}
              >
                <span>{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-slate-400" dir="ltr">
                  +{c.dial}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
