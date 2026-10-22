import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  isAdmin: boolean;
  /** Session presenter (runs /onlinesessions, records outcomes). Admins have every presenter right too. */
  isPresenter: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  isAdmin: false,
  isPresenter: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPresenter, setIsPresenter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // getSession() also finishes signing in from a magic-link redirect before we decide anything.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      setIsAdmin(false);
      setIsPresenter(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_session_presenter")]).then(([admin, presenter]) => {
      setIsAdmin(admin.data === true);
      setIsPresenter(presenter.data === true);
      setLoading(false);
    });
  }, [userId, ready]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ session, isAdmin, isPresenter, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
