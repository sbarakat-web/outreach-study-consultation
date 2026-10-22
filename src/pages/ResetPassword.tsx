import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Alert, Button, Card, Spinner } from "../components/ui";

export function ResetPassword() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    navigate("/dashboard", { replace: true });
  };

  if (authLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-md pt-4 sm:pt-10">
      <Card>
        <form onSubmit={submit} className="space-y-4 px-6 py-8 sm:px-8">
          <h1 className="text-center text-2xl font-black">Choose a new password</h1>
          {!session ? (
            <Alert>This reset link is invalid or has expired. Request a new one from the sign-in page.</Alert>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={loading} className="w-full">
                Save password
              </Button>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}
