import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Alert, Button, Card, Spinner } from "../components/ui";

interface Prefs {
  email: string;
  news: boolean;
  deadlines: boolean;
  unsubscribed: boolean;
}

/** Public "Manage email preferences" page linked from every marketing email footer. */
export function EmailPreferences() {
  const token = useSearchParams()[0].get("t") ?? "";
  const [p, setP] = useState<Prefs | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("marketing-prefs", { body: { token } }).then(({ data, error }) => {
      if (error || data?.error) setError("This link is invalid or has expired.");
      else setP(data as Prefs);
    });
  }, [token]);

  const save = async (patch: Partial<Prefs> & { unsubscribe?: boolean }) => {
    if (!p) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("marketing-prefs", { body: { token, news: patch.news ?? p.news, deadlines: patch.deadlines ?? p.deadlines, unsubscribe: patch.unsubscribe ?? false } });
    setBusy(false);
    if (error || data?.error) return setError("Could not save — please try again.");
    setP(data as Prefs);
    setSaved(patch.unsubscribe ? "You are unsubscribed from all marketing emails." : "Your preferences are saved.");
  };

  if (!p && !error) return <Spinner />;
  return (
    <div className="mx-auto max-w-lg pt-4 sm:pt-10">
      <Card>
        <div className="space-y-5 px-6 py-8 sm:px-8">
          <div className="text-center">
            <MailCheck className="mx-auto h-10 w-10 text-brand" />
            <h1 className="mt-2 text-2xl font-black">Email preferences</h1>
            {p && <p className="text-sm text-slate-500">{p.email}</p>}
          </div>
          {error && <Alert>{error}</Alert>}
          {saved && <Alert tone="success">{saved}</Alert>}
          {p && (
            <>
              {[
                { key: "news" as const, title: "News", text: "Scholarships, new programmes and study tips." },
                { key: "deadlines" as const, title: "Deadlines & reminders", text: "Intake deadlines and reminders about your application." },
              ].map((o) => (
                <label key={o.key} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={!p.unsubscribed && p[o.key]} onChange={(e) => setP({ ...p, [o.key]: e.target.checked, unsubscribed: false })} />
                  <span>
                    <span className="block font-bold">{o.title}</span>
                    <span className="text-sm text-slate-500">{o.text}</span>
                  </span>
                </label>
              ))}
              <Button className="w-full" loading={busy} onClick={() => save({})}>
                Save preferences
              </Button>
              <button onClick={() => save({ unsubscribe: true })} className="block w-full text-center text-sm font-bold text-slate-500 hover:text-brand-red">
                Unsubscribe from all marketing emails
              </button>
              <p className="text-center text-xs text-slate-400">Messages about a call you booked or your account are always sent.</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
