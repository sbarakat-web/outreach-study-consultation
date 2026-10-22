import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Alert, Button, Card, Spinner } from "../../components/ui";

interface Member {
  email: string;
  created_at: string;
}

export function Team() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <RoleList
        table="admins"
        title="Admins"
        singular="admin"
        description="Admins can see every lead, change statuses, run online sessions and add other team members."
      />
      <RoleList
        table="session_presenters"
        title="Session presenters"
        singular="session presenter"
        description="Session presenters only run online sessions (/onlinesessions) for booked candidates and record the outcome. They cannot see or edit other leads."
      />
    </div>
  );
}

function RoleList({
  table,
  title,
  singular,
  description,
}: {
  table: "admins" | "session_presenters";
  title: string;
  singular: string;
  description: string;
}) {
  const { session } = useAuth();
  const me = session?.user.email?.toLowerCase();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table).select("email, created_at").order("created_at");
    if (error) setError(error.message);
    setMembers(data ?? []);
  }, [table]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSaving(true);
    const { error } = await supabase.from(table).insert({ email: email.trim().toLowerCase(), added_by: session?.user.id });
    setSaving(false);
    if (error) return setError(error.code === "23505" ? `That person is already a ${singular}.` : error.message);
    setInfo(`${email} is now a ${singular}. They can sign in at ${window.location.origin}/login with this email (we email them a sign-in code).`);
    setEmail("");
    load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${singular} access for ${m.email}?`)) return;
    const { error } = await supabase.from(table).delete().eq("email", m.email);
    if (error) return setError(error.message);
    load();
  };

  return (
    <Card>
      <div className="space-y-4 px-5 py-6 sm:px-7">
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            placeholder="colleague@outreachstudy.eu"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={`New ${singular} email`}
          />
          <Button type="submit" loading={saving}>
            Add
          </Button>
        </form>
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        {!members ? (
          <Spinner />
        ) : members.length === 0 ? (
          <p className="text-sm text-slate-500">No {title.toLowerCase()} yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="truncate font-bold">
                  {m.email} {m.email === me && <span className="font-normal text-slate-400">(you)</span>}
                </span>
                {!(table === "admins" && m.email === me) && (
                  <button aria-label={`Remove ${m.email}`} onClick={() => remove(m)} className="text-slate-400 hover:text-brand-red">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
