import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const DEST = "/onlinesessions?present=1";
const MIN_MS = 2400; // long enough to see the three steps play once

const STEPS = [
  { icon: "🔗", title: "You opened your personal link", text: "No email, no code — the link is your key." },
  { icon: "🔒", title: "Signing you in securely", text: "You stay signed in on this device." },
  { icon: "▶", title: "Opening your online sessions", text: "Booked candidates are waiting in your queue." },
];

/**
 * Personal one-click sign-in (/loginnikki#k=<key>): no email, no code. The key is checked by the
 * presenter-link edge function while a short "how it works" animation plays. Without a key, or if
 * the link doesn't work, falls back to the normal email-code sign-in with the email pre-filled.
 */
export function PresenterLogin({ email, name }: { email: string; name: string }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const key = new URLSearchParams(window.location.hash.slice(1)).get("k");
  const [failed, setFailed] = useState(!key);
  const [step, setStep] = useState(0);
  const started = useRef(false);
  const already = !!session && !loading && !started.current;

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 1500);
    return () => (clearTimeout(t1), clearTimeout(t2));
  }, []);

  useEffect(() => {
    if (loading || session || !key || started.current) return;
    started.current = true;
    (async () => {
      const t0 = Date.now();
      const { data, error } = await supabase.functions.invoke("presenter-link", { body: { key } });
      if (error || !data?.token_hash) return setFailed(true);
      const { error: e2 } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
      if (e2) return setFailed(true);
      // Drop the key from the address bar and history once used.
      window.history.replaceState(null, "", window.location.pathname);
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - (Date.now() - t0))));
      navigate(DEST, { replace: true });
    })();
  }, [loading, session, key, navigate]);

  if (already) return <Navigate to={DEST} replace />;
  if (failed && !session)
    return <Navigate to={`/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(DEST)}`} replace />;

  return (
    <div className="mx-auto max-w-md px-4 pt-6 sm:pt-12">
      <style>{`
        @keyframes pl-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes pl-bar { from { width: 0 } to { width: 100% } }
        @keyframes pl-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
        .pl-in { animation: pl-in .45s ease-out both }
        .pl-bar { animation: pl-bar ${MIN_MS}ms ease-in-out both }
        .pl-pulse { animation: pl-pulse 1s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .pl-in, .pl-bar, .pl-pulse { animation: none } }
      `}</style>
      <div className="rounded-3xl border border-slate-100 bg-white px-6 py-8 shadow-sm sm:px-8">
        <p className="pl-in text-center text-sm font-bold uppercase tracking-wider text-brand">Welcome back</p>
        <h1 className="pl-in mt-1 text-center text-2xl font-black">Hi {name} 👋</h1>

        <ol className="mt-7 space-y-3">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={s.title}
                className={`pl-in flex items-start gap-3 rounded-2xl p-3 transition-colors duration-500 ${
                  active ? "bg-brand/10" : done ? "bg-emerald-50" : "bg-slate-50 opacity-50"
                }`}
                style={{ animationDelay: `${150 + i * 120}ms` }}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold transition-colors duration-500 ${
                    done ? "bg-emerald-500 text-white" : active ? "pl-pulse bg-brand text-white" : "bg-white text-slate-400"
                  }`}
                  aria-hidden
                >
                  {done ? "✓" : s.icon}
                </span>
                <span>
                  <span className="block font-bold text-slate-900">{s.title}</span>
                  <span className="block text-sm text-slate-500">{s.text}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Signing in">
          <div className="pl-bar h-full rounded-full bg-brand" />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Tip: bookmark this link — it always takes you straight to your sessions.
        </p>
      </div>
    </div>
  );
}
