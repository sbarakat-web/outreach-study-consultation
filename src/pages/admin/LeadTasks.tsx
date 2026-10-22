import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ListTodo, Star, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Consultation, Task } from "../../lib/types";
import { Button } from "../../components/ui";
import { loadStaff } from "./calls";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Adviser assignment, next-step tasks and the student's session feedback for one lead. */
export function LeadTasks({ c, onSaved }: { c: Consultation; onSaved: () => void }) {
  const [staff, setStaff] = useState<{ email: string }[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(inDays(2));

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").eq("consultation_id", c.id).order("due_at");
    setTasks((data as Task[]) ?? []);
  }, [c.id]);

  useEffect(() => {
    loadStaff().then(setStaff);
    loadTasks();
  }, [loadTasks]);

  const assign = async (email: string) => {
    await supabase.from("consultations").update({ assigned_to: email || null }).eq("id", c.id);
    onSaved();
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await supabase.from("tasks").insert({ consultation_id: c.id, title: title.trim(), due_at: new Date(`${due}T09:00`).toISOString() });
    setTitle("");
    loadTasks();
  };

  const toggle = async (t: Task) => {
    await supabase.from("tasks").update({ done_at: t.done_at ? null : new Date().toISOString() }).eq("id", t.id);
    loadTasks();
  };

  return (
    <div className="space-y-4 rounded-2xl bg-mist px-4 py-4 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-extrabold">
          <UserRound className="h-4 w-4 text-brand" /> Adviser
        </span>
        <select className="field w-auto py-1.5" value={c.assigned_to ?? ""} onChange={(e) => assign(e.target.value)}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.email}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 flex items-center gap-1.5 font-extrabold">
          <ListTodo className="h-4 w-4 text-brand" /> Next steps
        </p>
        {tasks.length === 0 && <p className="text-xs text-slate-500">No tasks yet.</p>}
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <input type="checkbox" className="accent-brand" checked={!!t.done_at} onChange={() => toggle(t)} aria-label={`Done: ${t.title}`} />
              <span className={t.done_at ? "text-slate-400 line-through" : ""}>{t.title}</span>
              <span className={`ml-auto text-xs ${!t.done_at && new Date(t.due_at) < new Date() ? "font-bold text-brand-red" : "text-slate-400"}`}>
                {new Date(t.due_at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input className="field py-2" placeholder="e.g. Check documents" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New task" />
          <input type="date" className="field w-auto py-2" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
          <Button type="submit" variant="secondary" className="min-h-10">
            Add
          </Button>
        </form>
      </div>

      {c.session_rating && (
        <div>
          <p className="mb-1 font-extrabold">Session feedback</p>
          <p className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < c.session_rating! ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
            ))}
            <span className="ml-2 text-xs text-slate-500">by {c.session_by ?? "adviser"}</span>
          </p>
          {c.session_feedback && <p className="mt-1 text-xs text-slate-600">“{c.session_feedback}”</p>}
        </div>
      )}
    </div>
  );
}
