import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { Alert, Button, Card, Spinner } from "../../../components/ui";
import { uploadAsset, type Asset } from "./shared";

export function useAssets() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("marketing_assets").select("*").order("created_at", { ascending: false });
    setAssets((data as Asset[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { assets, load };
}

/** Upload box: image is compressed and needs alt text (Gmail hides images by default). */
function Uploader({ onDone }: { onDone: (a: Asset) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };
  const upload = async () => {
    if (!file) return;
    if (!alt.trim()) return setError("Add a short description (alt text) — it shows when images are blocked.");
    setBusy(true);
    setError("");
    try {
      onDone(await uploadAsset(file, alt));
      setFile(null);
      setAlt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-brand">
        <ImagePlus className="h-5 w-5" /> {file ? file.name : "Choose an image (JPG, PNG, WebP, GIF)"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={pick} />
      </label>
      {file && (
        <>
          <input className="field" placeholder="Alt text, e.g. Students on campus in Malta" value={alt} onChange={(e) => setAlt(e.target.value)} />
          <Button className="w-full" loading={busy} onClick={upload}>
            Compress & upload
          </Button>
        </>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

export function Library() {
  const { assets, load } = useAssets();
  const [msg, setMsg] = useState("");
  if (!assets) return <Spinner />;

  const saveAlt = async (a: Asset, alt: string) => {
    await supabase.from("marketing_assets").update({ alt }).eq("id", a.id);
    setMsg("Alt text saved.");
    load();
  };
  const remove = async (a: Asset) => {
    if (!confirm("Remove this image from the library? Emails already sent keep it.")) return;
    await supabase.from("marketing_assets").delete().eq("id", a.id);
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <Card>
        <div className="space-y-3 px-5 py-5">
          <h2 className="text-lg font-black">Add to library</h2>
          <p className="text-xs text-slate-500">Campus photos, Malta, school logos… Images are resized to 1200px and compressed automatically.</p>
          <Uploader onDone={() => load()} />
        </div>
      </Card>
      <div className="space-y-3">
        {msg && <Alert tone="success">{msg}</Alert>}
        {assets.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No images yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {assets.map((a) => (
              <li key={a.id} className="ui-card overflow-hidden rounded-md bg-white">
                <img src={a.url} alt={a.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <div className="space-y-2 p-3">
                  <input
                    className={`field py-1.5 text-xs ${a.alt ? "" : "border-amber-400"}`}
                    defaultValue={a.alt}
                    placeholder="Alt text (required)"
                    onBlur={(e) => e.target.value !== a.alt && saveAlt(a, e.target.value)}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{a.width && a.height ? `${a.width}×${a.height}` : ""}</span>
                    <button onClick={() => remove(a)} className="inline-flex items-center gap-1 font-bold text-brand-red hover:underline">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Modal to pick an image from the library (or upload a new one). */
export function ImagePicker({ onPick, onClose }: { onPick: (a: Asset) => void; onClose: () => void }) {
  const { assets, load } = useAssets();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">Choose an image</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <Uploader
            onDone={(a) => {
              load();
              onPick(a);
            }}
          />
          {!assets ? (
            <Spinner />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {assets.map((a) => (
                <li key={a.id}>
                  <button onClick={() => onPick(a)} className="group relative block w-full overflow-hidden rounded-lg ring-1 ring-slate-200 hover:ring-brand">
                    <img src={a.url} alt={a.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    <span className="absolute inset-0 hidden place-items-center bg-brand/40 text-white group-hover:grid">
                      <Check className="h-6 w-6" />
                    </span>
                  </button>
                  {!a.alt && <p className="mt-0.5 text-[10px] font-bold text-amber-600">No alt text</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
