import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Alert, Button, Card, Spinner } from "../../components/ui";

interface Admin {
  email: string;
  created_at: string;
}

export function Team() {
  const { session } = useAuth();
  const me = session?.user.email?.toLowerCase();
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("admins").select("email, created_at").order("created_at");
    if (error) setError(error.message);
    setAdmins(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSaving(true);
    const { error } = await supabase.from("admins").insert({ email: email.trim().toLowerCase(), added_by: session?.user.id });
    setSaving(false);
    if (error) return setError(error.code === "23505" ? "That person is already an admin." : error.message);
    setInfo(`${email} is now an admin. Ask them to create an account at ${window.location.origin}/login with this email (or sign in if they already have one).`);
    setEmail("");
    load();
  };

  const remove = async (a: Admin) => {
    if (!confirm(`Remove admin access for ${a.email}?`)) return;
    const { error } = await supabase.from("admins").delete().eq("email", a.email);
    if (error) return setError(error.message);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <form onSubmit={add} className="space-y-4 px-5 py-6 sm:px-7">
          <h2 className="text-lg font-black">Add an admin</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="colleague@outreachrecruitment.eu"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Admin email"
            />
            <Button type="submit" loading={saving}>
              Add
            </Button>
          </div>
          <p className="text-xs text-slate-500">Admins can see every request, change statuses, manage time slots and add other admins.</p>
          {error && <Alert>{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}
        </form>
      </Card>

      <Card>
        <div className="px-5 py-5 sm:px-7">
          <h2 className="mb-3 text-lg font-black">Admins</h2>
          {!admins ? (
            <Spinner />
          ) : (
            <ul className="divide-y divide-slate-100">
              {admins.map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="truncate font-bold">
                    {a.email} {a.email === me && <span className="font-normal text-slate-400">(you)</span>}
                  </span>
                  {a.email !== me && (
                    <button aria-label={`Remove ${a.email}`} onClick={() => remove(a)} className="text-slate-400 hover:text-brand-red">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
