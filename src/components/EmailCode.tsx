import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Alert, Button } from "./ui";

/**
 * Passwordless sign-in: emails a one-time code (and a magic link) and verifies it.
 * Creates the account on first use, which also confirms the email address.
 */
export function EmailCode({
  email: fixedEmail,
  autoSend,
  next = "/dashboard",
  onSignedIn,
}: {
  email?: string;
  autoSend?: boolean;
  next?: string;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const autoSent = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${next}` },
    });
    setLoading(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many emails were sent just now. Please wait a minute and try again."
          : error.message,
      );
      return;
    }
    setSent(true);
    setCooldown(60);
  };

  useEffect(() => {
    if (autoSend && fixedEmail && !autoSent.current) {
      autoSent.current = true;
      send();
    }
  }, [autoSend, fixedEmail]);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setLoading(false);
    if (error) return setError("That code is not valid or has expired. Check the latest email or send a new code.");
    onSignedIn();
  };

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-3">
        {!fixedEmail && (
          <div>
            <label className="label" htmlFor="code-email">
              Email
            </label>
            <input
              id="code-email"
              type="email"
              required
              autoComplete="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} className="w-full">
          Email me a sign-in code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <p className="text-sm text-slate-600">
        We sent a code to <strong className="text-navy">{email}</strong>. Enter it below, or click the link in the email.
      </p>
      <div>
        <label className="label" htmlFor="otp">
          Code from the email
        </label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          required
          className="field text-center text-2xl font-black tracking-[0.4em]"
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" loading={loading} className="w-full">
        Open my dashboard
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button
          type="button"
          disabled={cooldown > 0 || loading}
          onClick={() => send()}
          className="font-bold text-brand-blue hover:underline disabled:text-slate-400 disabled:no-underline"
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
        </button>
        {!fixedEmail && (
          <button
            type="button"
            className="text-slate-500 hover:underline"
            onClick={() => {
              setSent(false);
              setCode("");
            }}
          >
            Use a different email
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Can’t find it? Check your spam or promotions folder.</p>
    </form>
  );
}
