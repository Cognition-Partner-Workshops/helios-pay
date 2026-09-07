"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiBase, setToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("viewer@acme.example");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new Error("Invalid email or password.");
      }
      const data = (await response.json()) as { access_token: string };
      setToken(data.access_token);
      router.push("/invoices");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="back-link" href="/">
          ← Helios Pay
        </Link>
        <p className="eyebrow">Operator access</p>
        <h1>Sign in to the console.</h1>
        <p className="lede">Review billing activity and partner operations from one workspace.</p>
        <form className="stacked-form" onSubmit={handleSubmit}>
          <label>
            Work email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="hint-text">Demo account: viewer@acme.example / Password123!</p>
      </div>
    </main>
  );
}
