import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Alert, Button, Card } from "../components/ui";
import { EmailCode } from "../components/EmailCode";

type Mode = "code" | "password" | "forgot";

export function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPath = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate(nextPath, { replace: true });
  }, [session, navigate, nextPath]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === "Invalid login credentials" ? "Wrong email or password. You can also sign in with an email link." : error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) setError(error.message);
      else setInfo("If an account exists for this email, we've sent a link to reset your password.");
    }
    setLoading(false);
  };

  const link = (to: Mode, label: string) => (
    <button
      type="button"
      className="font-bold text-brand-blue hover:underline"
      onClick={() => {
        setError("");
        setInfo("");
        setMode(to);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-md pt-4 sm:pt-10">
      <Card>
        <div className="space-y-4 px-6 py-8 sm:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-black">{mode === "forgot" ? "Reset your password" : "Open your dashboard"}</h1>
            {mode === "code" && <p className="mt-1 text-sm text-slate-500">Use the email you applied with. We’ll email you a sign-in link — no password needed.</p>}
          </div>

          {mode === "code" ? (
            <EmailCode next={nextPath} onSignedIn={() => navigate(nextPath, { replace: true })} />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {mode === "password" && (
                <div>
                  <label className="label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              {error && <Alert>{error}</Alert>}
              {info && <Alert tone="success">{info}</Alert>}
              <Button type="submit" loading={loading} className="w-full">
                {mode === "password" ? "Sign in" : "Send reset link"}
              </Button>
            </form>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
            {mode !== "code" && link("code", "Sign in with an email link")}
            {mode === "code" && link("password", "Use my password instead")}
            {mode === "password" && link("forgot", "Forgot password?")}
          </div>
        </div>
      </Card>
    </div>
  );
}
