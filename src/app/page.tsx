"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla la sessione iniziale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Ascolta i cambiamenti dello stato di autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-radial from-[#1e2433] to-[#0f1115]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400 opacity-70" />
      </div>
    );
  }

  return (
    <main>
      {session ? <Dashboard /> : <Login />}
    </main>
  );
}

