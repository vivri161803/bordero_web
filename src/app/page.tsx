"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla se l'utente ha una sessione ospite attiva
    const guestActive = sessionStorage.getItem("bordero_guest") === "true";
    if (guestActive) {
      setIsGuest(true);
    }

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
      <div className="min-h-screen flex items-center justify-center bg-radial from-[#1e2433] to-[#0f1115]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400 opacity-70" />
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

