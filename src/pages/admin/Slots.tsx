import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatSlot } from "../../lib/options";
import { Alert, Button, Card, Spinner } from "../../components/ui";

interface AdminSlot {
  id: string;
  starts_at: string;
  duration_minutes: number;
  consultation_id: string | null;
  consultations: { full_name: string } | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function Slots() {
  const [slots, setSlots] = useState<AdminSlot[] | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ from: today(), to: today(), start: "10:00", end: "17:00", duration: "30", days: [1, 2, 3, 4, 5] });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("slots")
      .select("id, starts_at, duration_minutes, consultation_id, consultations(full_name)")
      .gte("starts_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("starts_at")
      .limit(1000);
    if (error) setError(error.message);
    setSlots((data as unknown as AdminSlot[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Slot times are entered in the admin's local time zone.
  const preview = useMemo(() => {
    const out: Date[] = [];
    const dur = Number(form.duration);
    if (!form.from || !form.to || !dur) return out;
    const [sh, sm] = form.start.split(":").map(Number);
    const [eh, em] = form.end.split(":").map(Number);
    const day = new Date(`${form.from}T00:00`);
    const last = new Date(`${form.to}T00:00`);
    while (day <= last && out.length < 500) {
      if (form.days.includes(day.getDay())) {
        const t = new Date(day);
        t.setHours(sh, sm, 0, 0);
        const end = new Date(day);
        end.setHours(eh, em, 0, 0);
        while (t.getTime() + dur * 60000 <= end.getTime()) {
          if (t > new Date()) out.push(new Date(t));
          t.setMinutes(t.getMinutes() + dur);
        }
      }
      day.setDate(day.getDate() + 1);
    }
    return out;
  }, [form]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (preview.length === 0) return setError("No future slots in that range.");
    setSaving(true);
    const { data, error } = await supabase
      .from("slots")
      .upsert(
        preview.map((d) => ({ starts_at: d.toISOString(), duration_minutes: Number(form.duration) })),
        { onConflict: "starts_at", ignoreDuplicates: true },
      )
      .select("id");
    setSaving(false);
    if (error) return setError(error.message);
    setInfo(`Added ${data?.length ?? 0} slots${data && data.length < preview.length ? " (existing times were skipped)" : ""}.`);
    load();
  };

  const remove = async (s: AdminSlot) => {
    if (s.consultation_id && !confirm(`This slot is booked by ${s.consultations?.full_name}. Delete it anyway?`)) return;
    const { error } = await supabase.from("slots").delete().eq("id", s.id);
    if (error) return setError(error.message);
    load();
  };

  const removeAllFree = async () => {
    if (!confirm("Delete all free future slots?")) return;
    const { error } = await supabase.from("slots").delete().is("consultation_id", null).gt("starts_at", new Date().toISOString());
    if (error) return setError(error.message);
    load();
  };

  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));

  const days = useMemo(() => {
    const map = new Map<string, AdminSlot[]>();
    for (const s of slots ?? []) {
      const k = new Date(s.starts_at).toDateString();
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.values()];
  }, [slots]);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit">
        <form onSubmit={create} className="space-y-4 px-5 py-6">
          <h2 className="text-lg font-black">Add availability</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="from">From</label>
              <input id="from" type="date" className="field" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="to">To</label>
              <input id="to" type="date" className="field" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="start">Start time</label>
              <input id="start" type="time" className="field" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="end">End time</label>
              <input id="end" type="time" className="field" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="duration">Length</label>
            <select id="duration" className="field" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="label">Days</legend>
            <div className="flex flex-wrap gap-1.5">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={form.days.includes(i)}
                  onClick={() => toggleDay(i)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${form.days.includes(i) ? "bg-navy text-white" : "bg-mist text-slate-500"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">
            Times are in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). This will create {preview.length} slots.
          </p>
          {error && <Alert>{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}
          <Button type="submit" loading={saving} className="w-full">
            Add {preview.length} slots
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Upcoming slots</h2>
          {slots && slots.some((s) => !s.consultation_id) && (
            <Button variant="ghost" onClick={removeAllFree}>
              Delete all free
            </Button>
          )}
        </div>
        {!slots ? (
          <Spinner />
        ) : days.length === 0 ? (
          <p className="text-slate-500">No upcoming slots. Add availability so candidates can book.</p>
        ) : (
          days.map((ds) => (
            <Card key={ds[0].id}>
              <div className="px-5 py-4">
                <h3 className="mb-3 text-sm font-extrabold">
                  {formatSlot(ds[0].starts_at, { hour: undefined, minute: undefined, weekday: "long", month: "long" })}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {ds.map((s) => (
                    <li
                      key={s.id}
                      className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                        s.consultation_id ? "bg-brand-blue/10 text-navy" : "bg-mist"
                      }`}
                    >
                      <span className="font-bold">
                        {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {s.consultation_id && <span className="max-w-32 truncate text-xs">{s.consultations?.full_name}</span>}
                      <button aria-label="Delete slot" onClick={() => remove(s)} className="text-slate-400 hover:text-brand-red">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
