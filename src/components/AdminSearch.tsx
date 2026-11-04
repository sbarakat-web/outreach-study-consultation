import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { statusLabel } from "../lib/options";
import type { Status } from "../lib/types";

interface Hit {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string | null;
  status: Status;
  country: string | null;
}

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Header search for admins: name, email or phone; suggestions as you type, and picking one opens the candidate. */
export function AdminSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLFormElement>(null);

  // Loaded once, on first focus: the list is small enough to filter in the browser (phone numbers with spaces too).
  const load = () => {
    if (leads) return;
    supabase
      .from("consultations")
      .select("id, full_name, email, whatsapp, status, country")
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data }) => setLeads((data as Hit[]) ?? []));
  };

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t || !leads) return [];
    const d = digits(t);
    return leads
      .filter((c) => c.full_name.toLowerCase().includes(t) || c.email.toLowerCase().includes(t) || (d.length >= 4 && digits(c.whatsapp).includes(d)))
      .slice(0, 8);
  }, [q, leads]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (c: Hit) => {
    setOpen(false);
    setQ("");
    navigate(`/admin?lead=${c.id}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // One clear match (or the highlighted one): straight to the candidate; otherwise the filtered list.
    if (hits.length && (hits.length === 1 || open)) return go(hits[active] ?? hits[0]);
    setOpen(false);
    navigate(`/admin?q=${encodeURIComponent(q.trim())}`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Escape") setOpen(false);
  };

  return (
    <form ref={box} onSubmit={submit} role="search" className="relative hidden max-w-md flex-1 md:flex">
      <label className="relative flex-1">
        <span className="sr-only">Search candidates by name, email or phone</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onFocus={() => {
            load();
            setOpen(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="admin-search-results"
          aria-autocomplete="list"
          placeholder="Search name, email or phone"
          className="h-10 w-full rounded-l-md bg-slate-100 pl-11 pr-3 text-sm text-navy outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <button type="submit" className="h-10 rounded-r-md bg-brand px-5 text-sm font-bold text-white hover:bg-brand/90">
        Search
      </button>
      {open && q.trim() && (
        <ul id="admin-search-results" role="listbox" className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-200">
          {!leads ? (
            <li className="px-4 py-3 text-sm text-slate-500">Searching…</li>
          ) : hits.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">No candidate found. Press Enter to search all leads.</li>
          ) : (
            hits.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(c)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? "bg-brand/5" : ""}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold uppercase text-white">{c.full_name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-navy">{c.full_name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {c.email}
                      {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{statusLabel(c.status)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
