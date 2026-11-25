import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Spinner } from "../components/ui";

const DEST = "/onlinesessions?present=1";

/**
 * Personal one-click sign-in (/loginnikki#k=<key>): no email, no code. The key is checked by the
 * presenter-link edge function. Without a key, or if the link doesn't work, falls back to the
 * normal email-code sign-in with the email pre-filled. Once signed in, the session stays saved.
 */
export function PresenterLogin({ email }: { email: string }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const key = new URLSearchParams(window.location.hash.slice(1)).get("k");
  const [failed, setFailed] = useState(!key);
  const started = useRef(false);

  useEffect(() => {
    if (loading || session || !key || started.current) return;
    started.current = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("presenter-link", { body: { key } });
      if (error || !data?.token_hash) return setFailed(true);
      const { error: e2 } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
      if (e2) return setFailed(true);
      navigate(DEST, { replace: true });
    })();
  }, [loading, session, key, navigate]);

  if (session && !loading) return <Navigate to={DEST} replace />;
  if (failed)
    return <Navigate to={`/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(DEST)}`} replace />;
  return <Spinner />;
}
