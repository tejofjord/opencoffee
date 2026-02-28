import { FormEvent, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function AuthPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirect = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/";
  }, [location.search]);

  if (!loading && user) {
    return <Navigate to={redirect} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("Sending magic link...");

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(redirect)}`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setStatus(null);
      return;
    }

    setStatus("Check your email for the sign-in link.");
  }

  return (
    <div className="auth-shell">
      <div className="panel narrow">
        <h1>Sign in to OpenCoffee</h1>
        <p className="muted">Magic link only. No password required.</p>

        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
          />
          <button type="submit">Send magic link</button>
        </form>

        {status ? <p className="small">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
