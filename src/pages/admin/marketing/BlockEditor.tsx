import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, ImageIcon, Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "./Library";
import { BLOCK_LABELS, newBlock, type Block, type BlockType } from "./shared";

const TYPES = Object.keys(BLOCK_LABELS) as BlockType[];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

/** Image URL + alt with a "Choose from library" button. */
function ImageFields({ url, alt, onChange }: { url: string; alt: string; onChange: (url: string, alt: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? <img src={url} alt="" className="h-14 w-20 rounded-md object-cover ring-1 ring-slate-200" /> : <span className="grid h-14 w-20 place-items-center rounded-md bg-slate-100 text-slate-400"><ImageIcon className="h-5 w-5" /></span>}
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-brand hover:underline">
          {url ? "Change image" : "Choose from library"}
        </button>
      </div>
      <input className={`field py-2 text-sm ${alt.trim() ? "" : "border-amber-400"}`} placeholder="Alt text (required)" value={alt} onChange={(e) => onChange(url, e.target.value)} />
      {open && (
        <ImagePicker
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onChange(a.url, alt || a.alt);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BlockFields({ b, set }: { b: Block; set: (patch: Partial<Block>) => void }) {
  const text = (label: string, key: string, rows = 0, placeholder = "") => (
    <Field label={label}>
      {rows ? (
        <textarea className="field min-h-20 py-2 text-sm" rows={rows} placeholder={placeholder} value={(b as Record<string, string>)[key] ?? ""} onChange={(e) => set({ [key]: e.target.value } as Partial<Block>)} />
      ) : (
        <input className="field py-2 text-sm" placeholder={placeholder} value={(b as Record<string, string>)[key] ?? ""} onChange={(e) => set({ [key]: e.target.value } as Partial<Block>)} />
      )}
    </Field>
  );
  switch (b.type) {
    case "heading":
      return text("Heading", "text");
    case "text":
      return text("Text", "text", 4, "Use **bold**, and tags like {name}");
    case "image":
      return (
        <div className="space-y-2">
          <ImageFields url={b.url} alt={b.alt} onChange={(url, alt) => set({ url, alt })} />
          {text("Link (optional)", "href", 0, "https://… or {dashboard_link}")}
        </div>
      );
    case "button":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {text("Button text", "label")}
          {text("Link", "href", 0, "https://… or {dashboard_link}")}
        </div>
      );
    case "columns":
      return (
        <div className="space-y-2">
          <ImageFields url={b.image} alt={b.alt} onChange={(image, alt) => set({ image, alt })} />
          {text("Text", "text", 3)}
          {text("Image link (optional)", "href")}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand" checked={!!b.imageRight} onChange={(e) => set({ imageRight: e.target.checked })} /> Image on the right
          </label>
        </div>
      );
    case "spacer":
      return (
        <Field label={`Height: ${b.size}px`}>
          <input type="range" min={8} max={80} step={4} value={b.size} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full accent-brand" />
        </Field>
      );
    case "quote":
      return (
        <div className="space-y-2">
          {text("Quote", "text", 2)}
          {text("Author", "author")}
        </div>
      );
    case "programme":
      return (
        <div className="space-y-2">
          <ImageFields url={b.image} alt={b.alt} onChange={(image, alt) => set({ image, alt })} />
          <div className="grid gap-2 sm:grid-cols-2">
            {text("Programme", "name")}
            {text("Price", "price")}
            {text("Button text", "label")}
            {text("Link", "href")}
          </div>
        </div>
      );
    case "divider":
      return <p className="text-xs text-slate-400">A thin line between sections.</p>;
  }
}

export function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  const [adding, setAdding] = useState(false);
  const update = (i: number, patch: Partial<Block>) => onChange(blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: number) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + d, 0, b);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{BLOCK_LABELS[b.type]}</span>
            <span className="flex items-center gap-0.5 text-slate-400">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-slate-100 hover:text-navy disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-slate-100 hover:text-navy disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onChange([...blocks.slice(0, i + 1), { ...b, id: Math.random().toString(36).slice(2, 10) }, ...blocks.slice(i + 1)])} className="rounded p-1 hover:bg-slate-100 hover:text-navy" aria-label="Duplicate block">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onChange(blocks.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-red-50 hover:text-brand-red" aria-label="Delete block">
                <Trash2 className="h-4 w-4" />
              </button>
            </span>
          </div>
          <BlockFields b={b} set={(patch) => update(i, patch)} />
        </div>
      ))}
      <div className="relative">
        <button type="button" onClick={() => setAdding((v) => !v)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-bold text-slate-500 hover:border-brand hover:text-brand">
          <Plus className="h-4 w-4" /> Add block
        </button>
        {adding && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange([...blocks, newBlock(t)]);
                  setAdding(false);
                }}
                className="rounded-lg bg-white px-2 py-2 text-xs font-bold text-navy ring-1 ring-slate-200 hover:ring-brand"
              >
                {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
