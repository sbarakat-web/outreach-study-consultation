import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Alert, Button } from "./ui";
import { useI18n } from "../lib/i18n";

/**
 * Passwordless sign-in: emails a one-time code plus a link (supabase/templates/*.html).
 * The code is verified here; the link signs in directly. Creates the account on first
 * use, which also confirms the email address. `data` (name, course) personalises the
 * first email for new accounts.
 */
export function EmailCode({
  email: fixedEmail,
  autoSend,
  next = "/dashboard",
  data,
  onSignedIn,
}: {
  email?: string;
  data?: Record<string, string>;
  autoSend?: boolean;
  next?: string;
  onSignedIn: () => void;
}) {
  const { t } = useI18n();
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
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${next}`, data },
    });
    setLoading(false);
    if (error) {
      setError(
        error.status === 429 ? t("code.err429") : error.message,
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
    if (error) return setError(t("code.errInvalid"));
    onSignedIn();
  };

  if (!sent) {
    return (
      <form onSubmit={send} className="space-y-3">
        {!fixedEmail && (
          <div>
            <label className="label" htmlFor="code-email">
              {t("code.email")}
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
          {t("code.send")}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {t("code.sentA")} <strong className="text-navy">{email}</strong>. {t("code.sentB")}
      </p>
      <form onSubmit={verify} className="space-y-3">
        <div>
          <label className="label" htmlFor="otp">
            {t("code.label")}
          </label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            dir="ltr"
            className="field text-center text-2xl font-black tracking-[0.4em]"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} className="w-full">
          {t("code.open")}
        </Button>
      </form>
      <p className="text-xs text-slate-500">{t("code.spam")}</p>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button
          type="button"
          disabled={cooldown > 0 || loading}
          onClick={() => send()}
          className="font-bold text-brand hover:underline disabled:text-slate-400 disabled:no-underline"
        >
          {cooldown > 0 ? t("code.resendIn", { s: cooldown }) : t("code.resend")}
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
            {t("code.otherEmail")}
          </button>
        )}
      </div>
    </div>
  );
}
