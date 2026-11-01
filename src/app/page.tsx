"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  // La pagina viene renderizzata solo nel browser dopo il caricamento, quindi sessionStorage è disponibile
  const [isGuest, setIsGuest] = useState(() => {
    try { return typeof window !== "undefined" && sessionStorage.getItem("bordero_guest") === "true"; } catch { return false; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla la sessione iniziale di Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setIsGuest(false); // L'utente registrato ha la precedenza
      }
      setLoading(false);
    });

    // Ascolta i cambiamenti dello stato di autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setIsGuest(false);
        sessionStorage.removeItem("bordero_guest");
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGuestLogin = () => {
    sessionStorage.setItem("bordero_guest", "true");
    setIsGuest(true);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("bordero_guest");
    setIsGuest(false);
    setSession(null);
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Caricamento">
        <RefreshCw className="h-7 w-7 animate-spin text-ink-3" />
      </div>
    );
  }

  const isAuthenticated = !!session || isGuest;

  return (
    <main>
      {isAuthenticated ? (
        <Dashboard isGuest={isGuest} onLogout={handleLogout} />
      ) : (
        <Login onGuestLogin={handleGuestLogin} />
      )}
    </main>
  );
}

