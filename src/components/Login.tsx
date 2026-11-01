"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Lock, Mail, RefreshCw } from "lucide-react";
import { btn, cx } from "./dashboard/ui";

export default function Login({ onGuestLogin }: { onGuestLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          throw new Error("Credenziali non valide. Controlla email e password.");
        }
        throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore durante l'accesso.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "min-h-12 w-full rounded-lg border border-line bg-bg pl-10 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-4 h-1 w-12 rounded-full bg-accent" />
          <h1 className="text-3xl font-bold tracking-tight text-ink">Borderò</h1>
          <p className="mt-1 text-[15px] text-ink-3">Preparazione consegne · accedi per continuare</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-late/30 bg-late/10 p-3 text-sm text-late">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Email</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-ink-3" />
              <input type="email" required autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.com" className={cx(inputCls, "pr-3")} />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">Password</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-ink-3" />
              <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={cx(inputCls, "pr-12")} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          </label>

          <button type="submit" disabled={loading} className={cx(btn.primary, "min-h-12 w-full")}>
            {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> oppure <span className="h-px flex-1 bg-line" />
        </div>

        <button type="button" onClick={onGuestLogin} className={cx(btn.secondary, "min-h-12 w-full")}>
          Entra come ospite (solo lettura)
        </button>
      </div>
    </div>
  );
}
