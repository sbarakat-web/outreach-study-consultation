import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Pencil, Send, Trash2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { Alert, Button, Card, Spinner } from "../../../components/ui";
import { BlockEditor } from "./BlockEditor";
import { Preview, SpamPanel } from "./Preview";
import { TAGS, loadSettings, type MarketingSettings, type Template } from "./shared";

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("marketing_email_templates").select("*").order("is_system", { ascending: false }).order("created_at");
    setTemplates(((data ?? []) as Template[]).map((t) => ({ ...t, blocks: t.blocks ?? [] })));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { templates, load };
}

export function Templates() {
  const { templates, load } = useTemplates();
  const [editing, setEditing] = useState<Template | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (!templates) return <Spinner />;
  if (editing)
    return (
      <Editor
        template={editing}
        onClose={() => {
          setEditing(null);
          load();
        }}
      />
    );

  const duplicate = async (t: Template) => {
    const { data, error } = await supabase
      .from("marketing_email_templates")
      .insert({ name: `${t.name ?? "Template"} (copy)`, subject: t.subject, body: "", preheader: t.preheader, topic: t.topic, blocks: t.blocks })
      .select("*")
      .single();
    if (error) return setMsg({ tone: "error", text: error.message });
    await load();
    setEditing(data as Template);
  };
  const remove = async (t: Template) => {
    if (!confirm(`Delete “${t.name}”?`)) return;
    const { error } = await supabase.from("marketing_email_templates").delete().eq("id", t.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    load();
  };

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <li key={t.id} className="ui-card flex flex-col rounded-md bg-white">
            <div className="flex-1 space-y-1 px-5 py-4">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-navy">{t.name ?? "Untitled"}</h3>
                {t.is_system && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">Account invitations</span>}
              </div>
              <p className="truncate text-sm text-slate-500">{t.subject}</p>
              <p className="text-[11px] text-slate-400">
                {t.blocks.length} blocks · {t.topic === "deadlines" ? "Deadlines & reminders" : "News"}
              </p>
            </div>
            <div className="flex border-t border-slate-100 text-sm [&>*]:flex-1 [&>*]:py-3 [&>*+*]:border-l [&>*+*]:border-slate-100">
              <button onClick={() => setEditing(t)} className="inline-flex items-center justify-center gap-1.5 font-bold text-brand hover:bg-brand/5">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button onClick={() => duplicate(t)} className="inline-flex items-center justify-center gap-1.5 text-slate-600 hover:bg-slate-50">
                <Copy className="h-4 w-4" /> Duplicate
              </button>
              {!t.is_system && (
                <button onClick={() => remove(t)} className="inline-flex items-center justify-center gap-1.5 text-slate-500 hover:bg-red-50 hover:text-brand-red">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({ template, onClose }: { template: Template; onClose: () => void }) {
  const [t, setT] = useState(template);
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "copy" | "test">("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const fields = { name: t.name, subject: t.subject, preheader: t.preheader, topic: t.topic, blocks: t.blocks, updated_at: new Date().toISOString() };
  const save = async () => {
    setBusy("save");
    const { error } = await supabase.from("marketing_email_templates").update(fields).eq("id", t.id);
    setBusy("");
    setMsg(error ? { tone: "error", text: error.message } : { tone: "success", text: "Template saved." });
  };
  const saveAsNew = async () => {
    setBusy("copy");
    const { data, error } = await supabase
      .from("marketing_email_templates")
      .insert({ ...fields, body: "", name: `${t.name ?? "Template"} (new)` })
      .select("*")
      .single();
    setBusy("");
    if (error) return setMsg({ tone: "error", text: error.message });
    setT(data as Template);
    setMsg({ tone: "success", text: "Saved as a new template." });
  };
  const test = async () => {
    setBusy("test");
    const { data, error } = await supabase.functions.invoke("marketing-campaign", { body: { action: "test", template: t, subject: t.subject } });
    setBusy("");
    setMsg(error || data?.error ? { tone: "error", text: data?.error ?? error?.message ?? "Test failed" } : { tone: "success", text: `Test sent to ${data.to}.` });
  };

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> All templates
      </button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Template name</span>
                <input className="field" value={t.name ?? ""} onChange={(e) => setT({ ...t, name: e.target.value })} />
              </label>
              <label>
                <span className="label">Type</span>
                <select className="field" value={t.topic} onChange={(e) => setT({ ...t, topic: e.target.value as Template["topic"] })}>
                  <option value="news">News (scholarships, programmes)</option>
                  <option value="deadlines">Deadlines & reminders</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="label">Subject</span>
              <input className="field" value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Preview text (shown after the subject in the inbox)</span>
              <input className="field" value={t.preheader ?? ""} onChange={(e) => setT({ ...t, preheader: e.target.value })} />
            </label>
            <div className="rounded-xl bg-mist px-3 py-2.5 text-xs text-slate-600">
              <strong>Personalisation:</strong>{" "}
              {TAGS.map((g) => (
                <code key={g.tag} className="mr-1.5 inline-block rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200" title={`${g.label} — fallback: ${g.fallback || "link"}`}>
                  {`{${g.tag}}`}
                </code>
              ))}
              <span className="mt-1 block text-slate-400">Missing values use a fallback; set your own with <code>{"{course|your programme}"}</code>.</span>
            </div>
            <BlockEditor blocks={t.blocks} onChange={(blocks) => setT({ ...t, blocks })} />
            <div className="flex flex-wrap gap-2">
              <Button loading={busy === "save"} onClick={save}>
                Save template
              </Button>
              <Button variant="secondary" loading={busy === "copy"} onClick={saveAsNew}>
                Save as new
              </Button>
              <Button variant="ghost" loading={busy === "test"} onClick={test}>
                <Send className="h-4 w-4" /> Send test to me
              </Button>
            </div>
          </div>
        </Card>
        {settings && (
          <div className="space-y-4">
            <Preview blocks={t.blocks} preheader={t.preheader ?? ""} subject={t.subject} settings={settings} />
            <SpamPanel subject={t.subject} blocks={t.blocks} settings={settings} />
          </div>
        )}
      </div>
    </div>
  );
}
