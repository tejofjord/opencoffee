import { FormEvent, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function AuthPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirect = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/app";
  }, [location.search]);

  if (!loading && user) {
    return <Navigate to={redirect} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (usePassword && password) {
      setStatus("Signing in...");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setStatus(null);
        return;
      }
    } else {
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
  }

  return (
    <div className="auth-shell">
      <div className="panel narrow">
        <h1>Sign in to OpenCoffee</h1>
        <p className="muted">
          {usePassword ? "Sign in with your password." : "Magic link only. No password required."}
        </p>

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

          {usePassword && (
            <>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </>
          )}

          <button type="submit">
            {usePassword ? "Sign in" : "Send magic link"}
          </button>
        </form>

        <p className="small">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setUsePassword((v) => !v);
              setPassword("");
              setError(null);
              setStatus(null);
            }}
          >
            {usePassword ? "Use magic link instead" : "Sign in with password"}
          </button>
        </p>

        {status ? <p className="small">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
