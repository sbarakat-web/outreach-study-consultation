import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Alert, Button, Card } from "../components/ui";

type Mode = "signin" | "signup" | "forgot";

export function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPath = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
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
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Your password needs at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${nextPath}` },
        });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) throw new Error("An account with this email already exists. Please sign in.");
        if (!data.session) setInfo("Check your inbox and click the link to activate your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("If an account exists for this email, we've sent a link to reset your password.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, string> = {
    signin: "Sign in",
    signup: "Create an account",
    forgot: "Reset your password",
  };

  return (
    <div className="mx-auto max-w-md pt-4 sm:pt-10">
      <Card>
        <form onSubmit={submit} className="space-y-4 px-6 py-8 sm:px-8">
          <h1 className="text-center text-2xl font-black">{titles[mode]}</h1>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {error && <Alert>{error}</Alert>}
          {info && <Alert tone="success">{info}</Alert>}
          <Button type="submit" loading={loading} className="w-full">
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            {mode !== "signin" && (
              <button type="button" className="font-bold text-brand-blue hover:underline" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            )}
            {mode === "signin" && (
              <>
                <button type="button" className="font-bold text-brand-blue hover:underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
